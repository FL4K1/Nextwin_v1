// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NexTwin Access Control
 * @notice Manages patient data access permissions on Polygon
 * @dev Part of NexTwin Digital Twin Healthcare System
 */
contract NexTwinAccess {
    struct AccessGrant {
        address grantee;
        bytes32 dataScope;      // hash of data categories
        uint256 grantedAt;
        uint256 expiresAt;
        bool revoked;
    }

    // patient => grantee => AccessGrant
    mapping(address => mapping(address => AccessGrant)) public accessGrants;
    
    // patient => list of grantees
    mapping(address => address[]) public patientGrantees;
    
    // IPFS CID registry: patient => record hash => IPFS CID
    mapping(address => mapping(bytes32 => string)) public dataRegistry;

    event AccessGranted(
        address indexed patient,
        address indexed grantee,
        bytes32 dataScope,
        uint256 expiresAt
    );
    
    event AccessRevoked(
        address indexed patient,
        address indexed grantee
    );
    
    event DataStored(
        address indexed patient,
        bytes32 indexed recordHash,
        string ipfsCid
    );

    modifier onlyPatient() {
        require(msg.sender != address(0), "Invalid sender");
        _;
    }

    /**
     * @notice Grant data access to a healthcare provider
     * @param grantee Address of the doctor/provider
     * @param dataScope Hash representing which data categories are shared
     * @param durationSeconds How long the access lasts
     */
    function grantAccess(
        address grantee,
        bytes32 dataScope,
        uint256 durationSeconds
    ) external onlyPatient {
        require(grantee != address(0), "Invalid grantee");
        require(durationSeconds > 0, "Duration must be positive");

        uint256 expiry = block.timestamp + durationSeconds;

        accessGrants[msg.sender][grantee] = AccessGrant({
            grantee: grantee,
            dataScope: dataScope,
            grantedAt: block.timestamp,
            expiresAt: expiry,
            revoked: false
        });

        patientGrantees[msg.sender].push(grantee);

        emit AccessGranted(msg.sender, grantee, dataScope, expiry);
    }

    /**
     * @notice Revoke data access from a provider
     */
    function revokeAccess(address grantee) external onlyPatient {
        require(
            accessGrants[msg.sender][grantee].grantedAt > 0,
            "No existing grant"
        );

        accessGrants[msg.sender][grantee].revoked = true;
        emit AccessRevoked(msg.sender, grantee);
    }

    /**
     * @notice Check if a provider has valid access
     */
    function hasAccess(
        address patient,
        address grantee
    ) external view returns (bool) {
        AccessGrant memory grant = accessGrants[patient][grantee];
        return (
            grant.grantedAt > 0 &&
            !grant.revoked &&
            block.timestamp <= grant.expiresAt
        );
    }

    /**
     * @notice Store encrypted data reference on-chain
     */
    function storeData(
        bytes32 recordHash,
        string calldata ipfsCid
    ) external onlyPatient {
        dataRegistry[msg.sender][recordHash] = ipfsCid;
        emit DataStored(msg.sender, recordHash, ipfsCid);
    }

    /**
     * @notice Retrieve data CID (if caller has access)
     */
    function getData(
        address patient,
        bytes32 recordHash
    ) external view returns (string memory) {
        AccessGrant memory grant = accessGrants[patient][msg.sender];
        require(
            msg.sender == patient || (
                grant.grantedAt > 0 &&
                !grant.revoked &&
                block.timestamp <= grant.expiresAt
            ),
            "Access denied"
        );
        return dataRegistry[patient][recordHash];
    }
}
