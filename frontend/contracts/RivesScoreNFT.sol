// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import {Bitmask} from "@cartesi/util/contracts/Bitmask.sol";
import "@cartesi/rollups/contracts/dapp/ICartesiDApp.sol";
import "@cartesi/rollups/contracts/library/LibOutputValidation.sol";


contract RivesScoreNFT is ERC721URIStorage {
  using Counters for Counters.Counter;
  using Bitmask for mapping(uint256 => uint256);

  mapping(uint256 => uint256) noticeBitmask;

  mapping (bytes32 => address) public gamelogOwner;
  
  address public dappAddress;
  address public operator;

  Counters.Counter private _tokenIds;

  constructor(address _dappAddress) ERC721("RivesScoreNFT", "RSNFT") {
    dappAddress = _dappAddress;
    operator = msg.sender;
  }

  function setOperator(address newOperator) public {
    require(msg.sender == operator,"Only current operator can set new operator");
    operator = newOperator;
  }
  
  function verifySignature(bytes32 gameplayHash, bytes32 _r, bytes32 _s, uint8 _v) public pure returns (address) {
    bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", gameplayHash));
    return ecrecover(hash, _v, _r, _s);
  }

  function setGameplayOwner(bytes32 gameplayHash, bytes32 _r, bytes32 _s, uint8 _v) public {
    bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", gameplayHash));
    address signer = ecrecover(hash, _v, _r, _s);

    require(signer == operator,"Singned message does not match current operator");

    gamelogOwner[gameplayHash] = msg.sender;
  }

  function mint(bytes calldata _payload, Proof calldata _v) public returns (uint256) {
    ICartesiDApp dapp = ICartesiDApp(dappAddress);

    // validate notice
    dapp.validateNotice(_payload,_v);

    // query the current consensus for the desired claim
    (, uint256 firstInputIndex, ) = dapp.getConsensus().getClaim(dappAddress,_v.context);

    uint256 inputIndex = firstInputIndex + _v.validity.inputIndexWithinEpoch;

    // check if notice has been processed
    uint256 noticePosition = LibOutputValidation.getBitMaskPosition(_v.validity.outputIndexWithinInput,inputIndex);
    require(!noticeBitmask.getBit(noticePosition),"notice re-submiting not allowed");

    // abiTypes:['bytes32', 'string', 'uint', 'int', 'int', 'int', 'string', 'string', 'string', 'bytes32'],
    // params:['cartridge_id', 'user_address', 'timestamp', 'score', 'score_type', 'extra_score', 'extra', 'user_alias', 'screenshot_cid', 'gameplay_hash'],
    // process notice
    (, address userAddress, , , , , , , string memory screenshotCid, bytes32 gameplayHash) = abi.decode(_payload,(
        bytes32, address, uint, int, int, int, string, string, string, bytes32)
    );
      
    address recipient = userAddress;
    if (userAddress == operator) {
      require(gamelogOwner[gameplayHash] != address(0),"No gameplay owner defined");
      recipient = gamelogOwner[gameplayHash];
    }

    // mark it as processed
    noticeBitmask.setBit(noticePosition, true);
    _tokenIds.increment();

    uint256 newItemId = _tokenIds.current();
    _mint(recipient, newItemId);
    _setTokenURI(newItemId, string.concat("ipfs://", screenshotCid));

    return newItemId;
  }

  function ckeckMinted(bytes calldata _payload, Proof calldata _v) public view returns (bool) {
    ICartesiDApp dapp = ICartesiDApp(dappAddress);

    // validate notice
    dapp.validateNotice(_payload,_v);

    // query the current consensus for the desired claim
    (, uint256 firstInputIndex, ) = dapp.getConsensus().getClaim(dappAddress,_v.context);

    uint256 inputIndex = firstInputIndex + _v.validity.inputIndexWithinEpoch;

    // check if notice has been processed
    uint256 noticePosition = LibOutputValidation.getBitMaskPosition(_v.validity.outputIndexWithinInput,inputIndex);
    return noticeBitmask.getBit(noticePosition);
  }
}