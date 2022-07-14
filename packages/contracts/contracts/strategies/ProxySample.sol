// contract ProxySample {
//     // ADD SAME IMPLEMENTATION LAYOUT
//     // ADD IMPLEMENTATION SLOT

//     receive() external payable {}

//     fallback() external payable {
//         //Figure out the router contract for the given function
//         address implementation = getImplementation();
//         if (implementation == address(0)) {
//             _revertWithData(
//                 abi.encodeWithSelector(
//                     bytes4(keccak256("NotImplementedError(bytes4)")),
//                     selector
//                 )
//             );
//         }

//         //Delegate call to the router
//         (bool success, bytes memory resultData) = implementation.delegatecall(
//             msg.data
//         );
//         if (!success) {
//             _revertWithData(resultData);
//         }

//         _returnWithData(resultData);
//     }

//     function getImplementation() public view returns (address) {
//         return implementation;
//     }

//     function setImplementation(address _implementation) external onlyOwner {
//         implementation = _implementation;
//     }

//     function _revertWithData(bytes memory data) private pure {
//         assembly {
//             revert(add(data, 32), mload(data))
//         }
//     }

//     function _returnWithData(bytes memory data) private pure {
//         assembly {
//             return(add(data, 32), mload(data))
//         }
//     }
// }
