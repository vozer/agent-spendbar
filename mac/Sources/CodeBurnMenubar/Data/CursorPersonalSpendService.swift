import Foundation
import CoreFoundation

enum CursorPersonalSpendService {
    struct Identity: Sendable {
        let accessToken: String
        let authID: String
        let teamID: Int
        let userID: Int
    }

    struct Reading: Equatable, Sendable {
        let spentCents: Int
        let limitCents: Int
        let cycleStart: Date
        let cycleEnd: Date
        let authID: String
        let teamID: Int
        let userID: Int
        let onDemandOnly: Bool
    }

    enum FetchError: Error, Equatable {
        case invalidIdentity
        case authenticationRejected
        case rateLimited(retryAfter: TimeInterval)
        case providerUnavailable
        case invalidResponse
        case network
    }

    typealias Fetch = @Sendable (URLRequest) async throws -> (Data, HTTPURLResponse)

    static let liveFetch: Fetch = { request in
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw FetchError.network }
        return (data, http)
    }

    static func loadIdentity(accessToken: String, teamID: Int, expectedAuthID: String? = nil, fetch: Fetch = liveFetch) async throws -> Identity {
        guard teamID > 0, let subject = tokenSubject(accessToken),
              expectedAuthID == nil || expectedAuthID == subject else { throw FetchError.invalidIdentity }
        let provisional = Identity(accessToken: accessToken, authID: subject, teamID: teamID, userID: 1)
        let me = try await request("GetMe", body: ["teamId": teamID], identity: provisional, fetch: fetch)
        guard let authID = me["authId"] as? String, authID == subject,
              let userID = integer(me["userId"]), userID > 0,
              me["teamId"] == nil || integer(me["teamId"]) == teamID else { throw FetchError.invalidIdentity }
        return Identity(accessToken: accessToken, authID: authID, teamID: teamID, userID: userID)
    }

    private static func tokenSubject(_ token: String) -> String? {
        let parts = token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3 else { return nil }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let subject = json["sub"] as? String, !subject.isEmpty else { return nil }
        return subject
    }

    static func refresh(identity: Identity, now: Date = Date(), fetch: Fetch = liveFetch) async throws -> Reading {
        guard !identity.accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !identity.authID.isEmpty,
              identity.teamID > 0, identity.userID > 0 else { throw FetchError.invalidIdentity }

        let cycle = try await request("GetMonthlyBillingCycle", body: [:], identity: identity, fetch: fetch)
        guard let start = milliseconds(cycle["startDateEpochMillis"]),
              let end = milliseconds(cycle["endDateEpochMillis"]),
              start < end, Double(start) <= now.timeIntervalSince1970 * 1000,
              now.timeIntervalSince1970 * 1000 < Double(end) else { throw FetchError.invalidResponse }
        let scope: [String: Any] = ["teamId": identity.teamID, "userId": identity.userID]
        let aggregate = try await request("GetAggregatedUsageEvents", body: scope.merging([
            "startDate": String(start), "endDate": String(end)
        ]) { _, new in new }, identity: identity, fetch: fetch)
        let onDemandOnly = aggregate["totalRequestCost"] != nil && !(aggregate["totalRequestCost"] is NSNull)
        let chart = try await request("GetDailySpendByCategory", body: scope.merging([
            "periodStartMs": String(start), "periodEndMs": String(end),
            "groupBy": 1, "spendType": onDemandOnly ? 1 : 3
        ]) { _, new in new }, identity: identity, fetch: fetch)
        guard let limit = integer(chart["effectiveLimitCents"]), limit > 0 else { throw FetchError.invalidResponse }
        let rows: [[String: Any]]
        if let value = chart["dailySpend"] {
            guard let parsed = value as? [[String: Any]] else { throw FetchError.invalidResponse }
            rows = parsed
        } else {
            rows = []
        }
        let todayEnd = (floor(now.timeIntervalSince1970 / 86_400) + 1) * 86_400_000
        let firstDay = floor(Double(start) / 86_400_000) * 86_400_000
        var spent = 0
        for row in rows {
            guard let day = milliseconds(row["day"]), Double(day) >= firstDay, Double(day) < Double(end),
                  let amount = row["spendCents"] == nil ? 0 : integer(row["spendCents"]), amount >= 0 else { throw FetchError.invalidResponse }
            if Double(day) < todayEnd {
                let (sum, overflow) = spent.addingReportingOverflow(amount)
                guard !overflow else { throw FetchError.invalidResponse }
                spent = sum
            }
        }
        return Reading(spentCents: spent, limitCents: limit,
                       cycleStart: Date(timeIntervalSince1970: Double(start) / 1000),
                       cycleEnd: Date(timeIntervalSince1970: Double(end) / 1000),
                       authID: identity.authID, teamID: identity.teamID, userID: identity.userID, onDemandOnly: onDemandOnly)
    }

    private static func integer(_ value: Any?) -> Int? {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        return number as? Int
    }

    private static func milliseconds(_ value: Any?) -> Int64? {
        if let value = value as? String { return Int64(value) }
        return integer(value).map(Int64.init)
    }

    private static func request(_ method: String, body: [String: Any], identity: Identity, fetch: Fetch) async throws -> [String: Any] {
        let url = URL(string: "https://api2.cursor.sh/aiserver.v1.DashboardService/\(method)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.setValue("Bearer \(identity.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(String(identity.teamID), forHTTPHeaderField: "x-cursor-team-id")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("1", forHTTPHeaderField: "connect-protocol-version")
        request.setValue("CodeBurn", forHTTPHeaderField: "User-Agent")
        let data: Data
        let response: HTTPURLResponse
        do {
            (data, response) = try await fetch(request)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw FetchError.network
        }
        switch response.statusCode {
        case 200...299: break
        case 401, 403: throw FetchError.authenticationRejected
        case 429:
            let header = response.value(forHTTPHeaderField: "Retry-After")
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(secondsFromGMT: 0)
            formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
            let delay = header.flatMap(TimeInterval.init) ?? header.flatMap { formatter.date(from: $0)?.timeIntervalSinceNow }
            throw FetchError.rateLimited(retryAfter: delay.flatMap { $0.isFinite ? max(0, $0) : nil } ?? 300)
        case 500...599: throw FetchError.providerUnavailable
        default: throw FetchError.invalidResponse
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw FetchError.invalidResponse
        }
        return json
    }
}
