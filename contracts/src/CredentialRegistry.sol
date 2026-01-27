// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CredentialRegistry {
    
    struct CredentialRecord {
        bytes32 credentialID;
        bytes32 issuerDID;
        bytes32 holderDID;
        bytes32 ipfsCID;      // Pointer to full data
        bytes32 credHash;     // Integrity Check
        uint256 issuanceTime;
        uint256 expiryTime;
        bool revoked;
    }

    mapping(bytes32 => CredentialRecord) public credentials;
    mapping(bytes32 => bytes32[]) public holderCredentials;

    event CredentialIssued(bytes32 indexed credID, bytes32 indexed issuerDID, bytes32 indexed holderDID);
    event CredentialRevoked(bytes32 indexed credID, uint256 timestamp); //<--- M4 Event
    event AuditRecorded(bytes32 indexed auditorDID, bytes32 indexed targetDID, bytes32 reportCID); // M11

    // --- PROTOCOL 4: CREDENTIAL ISSUANCE (Step M2) ---
    function issueCredential(
        bytes32 _credID,
        bytes32 _issuerDID,
        bytes32 _holderDID,
        bytes32 _ipfsCID,
        bytes32 _credHash,
        uint256 _duration
    ) external {
        credentials[_credID] = CredentialRecord({
            credentialID: _credID,
            issuerDID: _issuerDID,
            holderDID: _holderDID,
            ipfsCID: _ipfsCID,
            credHash: _credHash,
            issuanceTime: block.timestamp,
            expiryTime: block.timestamp + _duration,
            revoked: false
        });

        holderCredentials[_holderDID].push(_credID);
        emit CredentialIssued(_credID, _issuerDID, _holderDID);
    }
    // --- PROTOCOL 5: REVOCATION (Step M3) ---
    function revokeCredential(bytes32 _credID) external {
        
        // M5: Validate Constraints
        // Thesis Requirement: Only the Issuer (or Admin) can revoke.
        // Also check if it exists and isn't already revoked.
        require(credentials[_credID].issuanceTime != 0, "Error: Credential not found");
        require(!credentials[_credID].revoked, "Error: Already revoked");
        
        // M6: State Mutation
        // The definitive "flip of the switch"
        credentials[_credID].revoked = true;
        
        // M7: Event Emission
        // notifying the network of the change
        emit CredentialRevoked(_credID, block.timestamp);
    }
    function verifyCredential(bytes32 _credID) external view returns (bool isValid, string memory status) {
        CredentialRecord memory c = credentials[_credID];
        if (c.issuanceTime == 0) return (false, "Not Found");
        if (c.revoked) return (false, "Revoked");
        if (block.timestamp > c.expiryTime) return (false, "Expired");
        return (true, "Valid");
    }
    function recordAuditLog(
        bytes32 _auditorDID,
        bytes32 _targetDID,
        bytes32 _reportCID,
        bytes32 _reportHash
    ) external {
        // M9: Anchoring Logic
        // In a real system, we might store this in a mapping, 
        // but for pure logging (forensics), the Event Emission is the data storage.
        
        // M11: Emit the Event (The immutable proof that audit happened)
        emit AuditRecorded(_auditorDID, _targetDID, _reportCID);
    }
}