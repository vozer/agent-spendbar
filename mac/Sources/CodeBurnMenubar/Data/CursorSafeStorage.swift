import CommonCrypto
import Foundation
import Security

/// Unlocks Cursor's Chromium safe-storage session without spawning `security`.
final class CursorSafeStorage: @unchecked Sendable {
    enum Failure: Error, Equatable {
        case locked
        case invalidCiphertext
    }

    private let lock = NSLock()
    private let readPassword: @Sendable () throws -> String?
    private var password: String?

    init(readPassword: @escaping @Sendable () throws -> String? = { try CursorSafeStorage.keychainPassword() }) {
        self.readPassword = readPassword
    }

    /// Only an explicit user action may access Keychain; refreshes use memory.
    func unlock(_ stored: String, allowPrompt: Bool) throws -> String {
        guard stored.hasPrefix("cursor-safe-storage:") else { return stored }
        return try lock.withLock {
            let key: String
            if let password {
                key = password
            } else {
                guard allowPrompt, let loaded = try readPassword(), !loaded.isEmpty else {
                    throw Failure.locked
                }
                key = loaded
            }
            guard let token = Self.decrypt(stored, password: key) else {
                password = nil
                throw Failure.invalidCiphertext
            }
            password = key
            return token
        }
    }

    func clear() {
        lock.withLock { password = nil }
    }

    // Cursor 3.27's v10 format, as decoded by CodeBurn's CursorSafeStorage.
    private static func decrypt(_ stored: String, password: String) -> String? {
        let prefix = "cursor-safe-storage:v1:"
        guard stored.hasPrefix(prefix),
              let blob = Data(base64Encoded: String(stored.dropFirst(prefix.count))),
              blob.count > 3, blob.prefix(3) == Data("v10".utf8) else { return nil }
        let ciphertext = [UInt8](blob.dropFirst(3))
        let passwordBytes = Array(password.utf8)
        let salt = Array("saltysalt".utf8)
        var key = [UInt8](repeating: 0, count: kCCKeySizeAES128)
        guard CCKeyDerivationPBKDF(CCPBKDFAlgorithm(kCCPBKDF2), passwordBytes, passwordBytes.count,
                                  salt, salt.count, CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA1),
                                  1003, &key, key.count) == kCCSuccess else { return nil }
        let iv = [UInt8](repeating: 0x20, count: kCCBlockSizeAES128)
        var output = [UInt8](repeating: 0, count: ciphertext.count + kCCBlockSizeAES128)
        var count = 0
        guard CCCrypt(CCOperation(kCCDecrypt), CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding),
                      key, key.count, iv, ciphertext, ciphertext.count, &output, output.count, &count) == kCCSuccess,
              count > 0, let token = String(bytes: output.prefix(count), encoding: .utf8), !token.isEmpty else {
            return nil
        }
        return token
    }

    private static func keychainPassword() throws -> String? {
        for account in ["Cursor Key", "Cursor"] {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: "Cursor Safe Storage",
                kSecAttrAccount as String: account,
                kSecMatchLimit as String: kSecMatchLimitOne,
                kSecReturnData as String: true,
            ]
            var result: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            if status == errSecItemNotFound { continue }
            guard status == errSecSuccess, let data = result as? Data,
                  let value = String(data: data, encoding: .utf8) else { throw Failure.locked }
            return value
        }
        return nil
    }
}
