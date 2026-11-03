import Foundation
import XCTest
@testable import CodeBurnMenubar

@MainActor
final class CursorPersonalSpendServiceTests: XCTestCase {
    final class Recorder: @unchecked Sendable {
        var requests: [URLRequest] = []
        func fetch(_ request: URLRequest) throws -> (Data, HTTPURLResponse) {
            requests.append(request)
            let body: String
            switch request.url!.lastPathComponent {
            case "GetMonthlyBillingCycle": body = #"{"startDateEpochMillis":"1793491200000","endDateEpochMillis":"1796083200000"}"#
            case "GetAggregatedUsageEvents": body = #"{}"#
            case "GetDailySpendByCategory": body = #"{"dailySpend":[{"day":"1793664000000","spendCents":2415},{"day":"1793923200000","spendCents":900}],"effectiveLimitCents":10000}"#
            default: throw CursorPersonalSpendService.FetchError.invalidResponse
            }
            return (Data(body.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
    }

    func testCurrentPersonalSpendUsesCursorCycleAndExcludesFutureDays() async throws {
        let recorder = Recorder()
        let identity = CursorPersonalSpendService.Identity(accessToken: "synthetic", authID: "auth0|test", teamID: 7, userID: 9)
        let result = try await CursorPersonalSpendService.refresh(identity: identity, now: Date(timeIntervalSince1970: 1793721600)) { request in
            try recorder.fetch(request)
        }
        XCTAssertEqual(result.spentCents, 2415)
        XCTAssertEqual(result.limitCents, 10000)
        XCTAssertEqual(result.cycleStart, Date(timeIntervalSince1970: 1793491200))
        XCTAssertEqual(recorder.requests.map { $0.url!.lastPathComponent }, ["GetMonthlyBillingCycle", "GetAggregatedUsageEvents", "GetDailySpendByCategory"])
        let request = recorder.requests[2]
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer synthetic")
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(request.httpBody)) as? [String: Any])
        XCTAssertEqual(json["teamId"] as? Int, 7)
        XCTAssertEqual(json["userId"] as? Int, 9)
        XCTAssertEqual(json["groupBy"] as? Int, 1)
        XCTAssertEqual(json["spendType"] as? Int, 3)
        XCTAssertEqual(json["periodStartMs"] as? String, "1793491200000")
    }

    func testIdentityMustMatchTheAuthenticatedUser() async throws {
        let payload = Data(#"{"sub":"auth0|test"}"#.utf8).base64EncodedString()
        let token = "header.\(payload).signature"
        let identity = try await CursorPersonalSpendService.loadIdentity(accessToken: token, teamID: 7) { request in
            XCTAssertEqual(request.url?.lastPathComponent, "GetMe")
            XCTAssertEqual(request.value(forHTTPHeaderField: "x-cursor-team-id"), "7")
            return (Data(#"{"authId":"auth0|test","userId":9,"teamId":7}"#.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        XCTAssertEqual(identity.userID, 9)
        do {
            _ = try await CursorPersonalSpendService.loadIdentity(accessToken: token, teamID: 7) { request in
                (Data(#"{"authId":"other","userId":9}"#.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
            }
            XCTFail("Expected identity mismatch")
        } catch let error as CursorPersonalSpendService.FetchError {
            XCTAssertEqual(error, .invalidIdentity)
        }
    }

    func testChangedAccountIsRejectedBeforeNetworkAccess() async throws {
        let payload = Data(#"{"sub":"auth0|new"}"#.utf8).base64EncodedString()
        do {
            _ = try await CursorPersonalSpendService.loadIdentity(accessToken: "header.\(payload).signature", teamID: 7, expectedAuthID: "auth0|old") { _ in
                XCTFail("Changed account must not make a request")
                throw CursorPersonalSpendService.FetchError.network
            }
            XCTFail("Expected identity mismatch")
        } catch let error as CursorPersonalSpendService.FetchError {
            XCTAssertEqual(error, .invalidIdentity)
        }
    }

    func testRequestBasedPlanSelectsOnDemandAndMalformedLimitFails() async throws {
        let identity = CursorPersonalSpendService.Identity(accessToken: "synthetic", authID: "auth0|test", teamID: 7, userID: 9)
        do {
            _ = try await CursorPersonalSpendService.refresh(identity: identity, now: Date(timeIntervalSince1970: 1793721600)) { request in
                let body: String
                switch request.url!.lastPathComponent {
                case "GetMonthlyBillingCycle": body = #"{"startDateEpochMillis":"1793491200000","endDateEpochMillis":"1796083200000"}"#
                case "GetAggregatedUsageEvents": body = #"{"totalRequestCost":0}"#
                default:
                    let json = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(request.httpBody)) as? [String: Any])
                    XCTAssertEqual(json["spendType"] as? Int, 1)
                    body = #"{"dailySpend":[],"effectiveLimitCents":true}"#
                }
                return (Data(body.utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
            }
            XCTFail("Expected invalid limit")
        } catch let error as CursorPersonalSpendService.FetchError {
            XCTAssertEqual(error, .invalidResponse)
        }
    }

    func testRateLimitPreservesRetryAfter() async {
        do {
            _ = try await CursorPersonalSpendService.refresh(identity: .init(accessToken: "synthetic", authID: "auth0|test", teamID: 7, userID: 9)) { request in
                (Data(), HTTPURLResponse(url: request.url!, statusCode: 429, httpVersion: nil, headerFields: ["Retry-After": "120"])!)
            }
            XCTFail("Expected rate limit")
        } catch let error as CursorPersonalSpendService.FetchError {
            XCTAssertEqual(error, .rateLimited(retryAfter: 120))
        } catch { XCTFail("Unexpected error: \(error)") }
    }
}
