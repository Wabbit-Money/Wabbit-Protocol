//SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../lib/FractionMath.sol";
import "../FlashSwap/IFlashSwap.sol";
import "./MarginLongRepay.sol";

abstract contract MarginLongLiquidate is MarginLongRepay {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    FractionMath.Fraction private _liquidationFeePercent;

    constructor(uint256 liquidationFeePercentNumerator_, uint256 liquidationFeePercentDenominator_) {
        _liquidationFeePercent.numerator = liquidationFeePercentNumerator_;
        _liquidationFeePercent.denominator = liquidationFeePercentDenominator_;
    }

    // Get the liquidation fee percent
    function liquidationFeePercent() public view returns (uint256, uint256) {
        return (_liquidationFeePercent.numerator, _liquidationFeePercent.denominator);
    }

    // Set the liquidation fee percent
    function setLiquidationFeePercent(uint256 liquidationFeePercentNumerator_, uint256 liquidationFeePercentDenominator_) external onlyOwner {
        _liquidationFeePercent.numerator = liquidationFeePercentNumerator_;
        _liquidationFeePercent.denominator = liquidationFeePercentDenominator_;
    }

    // Liquidate all accounts that have not been repaid by the repay greater
    function _liquidate(
        address account_,
        IFlashSwap flashSwap_,
        bytes memory data_
    ) internal {
        IERC20[] memory borrowedTokens = borrowedTokens(account_);

        IERC20[] memory repayTokens = new IERC20[](borrowedTokens.length);
        uint256[] memory repayAmounts = new uint256[](borrowedTokens.length);

        for (uint256 i = 0; i < borrowedTokens.length; i++) {
            IERC20 token = borrowedTokens[i];

            uint256 currentPrice = _borrowedPrice(token, account_);
            uint256 initialPrice = initialBorrowPrice(token, account_);
            uint256 interest = pool.interest(token, initialPrice, initialBorrowBlock(token, account_));

            uint256 repayPrice = initialPrice.add(interest).sub(currentPrice);
            uint256 repayAmount = oracle.amount(token, repayPrice);

            (uint256 liqPercentNumerator, uint256 liqPercentDenominator) = liquidationFeePercent();
            repayTokens[i] = token;
            repayAmounts[i] = liqPercentDenominator.sub(liqPercentNumerator).mul(repayAmount).div(liqPercentDenominator);

            _setBorrowed(token, 0, account_);
            _setInitialBorrowPrice(token, 0, account_);
            _setCollateral(token, 0, account_);
        }

        IERC20[] memory collateralTokens = collateralTokens(account_);
        uint256[] memory collateralAmounts = new uint256[](collateralTokens.length);
        for (uint256 i = 0; i < collateralTokens.length; i++) collateralAmounts[i] = collateral(collateralTokens[i], account_);

        uint256[] memory amountOut = _flashSwap(collateralTokens, collateralAmounts, repayTokens, repayAmounts, flashSwap_, data_);
        for (uint256 i = 0; i < amountOut.length; i++) {
            repayTokens[i].safeApprove(address(pool), amountOut[i]);
            pool.deposit(repayTokens[i], amountOut[i]);
        }
    }

    // Liquidate an undercollateralized account
    function liquidate(
        address account_,
        IFlashSwap flashSwap_,
        bytes memory data_
    ) external {
        require(underCollateralized(account_), "Only undercollateralized accounts may be liquidated");

        _repayPayout(account_);
        _liquidate(account_, flashSwap_, data_);

        emit Liquidated(account_, _msgSender(), flashSwap_, data_);
    }

    event Liquidated(address indexed account, address liquidator, IFlashSwap flashSwap, bytes data);
}
