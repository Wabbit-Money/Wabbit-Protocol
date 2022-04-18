//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {StrategyBase} from "./StrategyBase.sol";

import {Config} from "../../../helpers/Config.sol";
import {BeefyLPStrategy} from "../../../../../contracts/lens/strategy/BeefyLPStrategy.sol";
import {TorqueVaultV1} from "../../../../../contracts/lens/vault/TorqueVaultV1.sol";

contract VaultTest is StrategyBase {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    TorqueVaultV1 private vault;
    BeefyLPStrategy private strategy;
    address private empty;

    function setUp() public override {
        super.setUp();

        strategy = _getStrategy();
        empty = _getEmpty();

        vault = new TorqueVaultV1();
        vault.initialize(Config.getToken(), strategy, _getEmpty(), 1, 1000);

        strategy.grantRole(strategy.STRATEGY_CONTROLLER_ROLE(), address(vault));
        vault.grantRole(vault.VAULT_CONTROLLER_ROLE(), address(this));

        address[] memory spender = new address[](1);
        spender[0] = address(vault);
        _approveAll(spender);
    }

    // Tests
}
