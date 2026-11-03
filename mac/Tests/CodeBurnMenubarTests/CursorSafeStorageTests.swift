import Foundation
import Testing
@testable import CodeBurnMenubar

@Suite("Cursor safe storage")
struct CursorSafeStorageTests {
    private let encrypted = "cursor-safe-storage:v1:djEwv1UEffqnXa9DEGVR+fz0J2c1o08jLtgcx3UEPN6OWnc="

    @Test("requires user action and never reads the Keychain in the background")
    func unlockRequiresConsent() throws {
        let storage = CursorSafeStorage(readPassword: { "synthetic-password" })
        #expect(throws: CursorSafeStorage.Failure.locked) {
            try storage.unlock(encrypted, allowPrompt: false)
        }
        #expect(try storage.unlock(encrypted, allowPrompt: true) == "synthetic.jwt.value")
        #expect(try storage.unlock(encrypted, allowPrompt: false) == "synthetic.jwt.value")
        let rotated = "cursor-safe-storage:v1:djEwXfTMbKO4P5roO7ONjYf/Vw=="
        #expect(try storage.unlock(rotated, allowPrompt: false) == "other.jwt.value")
        #expect(throws: CursorSafeStorage.Failure.invalidCiphertext) {
            try storage.unlock("cursor-safe-storage:v1:bad", allowPrompt: false)
        }
        #expect(throws: CursorSafeStorage.Failure.locked) {
            try storage.unlock(encrypted, allowPrompt: false)
        }
        #expect(try storage.unlock(encrypted, allowPrompt: true) == "synthetic.jwt.value")
        storage.clear()
        #expect(throws: CursorSafeStorage.Failure.locked) {
            try storage.unlock(encrypted, allowPrompt: false)
        }
    }

    @Test("rejects denied access and malformed ciphertext")
    func errors() throws {
        let denied = CursorSafeStorage(readPassword: { nil })
        #expect(throws: CursorSafeStorage.Failure.locked) {
            try denied.unlock(encrypted, allowPrompt: true)
        }
        let storage = CursorSafeStorage(readPassword: { "synthetic-password" })
        #expect(throws: CursorSafeStorage.Failure.invalidCiphertext) {
            try storage.unlock("cursor-safe-storage:v1:bad", allowPrompt: true)
        }
        #expect(try storage.unlock("legacy-token", allowPrompt: false) == "legacy-token")
    }
}
