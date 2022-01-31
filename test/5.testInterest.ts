import {expect} from "chai";
import {BigNumber} from "ethers";
import {ethers} from "hardhat";
import config from "../config.fork.json";
import wait from "../scripts/util/utilWait";
import {ERC20, LPool, MarginLong, OracleTest} from "../typechain-types";

describe("Interest", async function () {
    let collateralApproved: any;
    let collateralToken: ERC20;

    let borrowedApproved: any;
    let borrowedToken: ERC20;

    let lpToken: ERC20;

    let oracle: OracleTest;
    let marginLong: MarginLong;
    let pool: LPool;

    let signerAddress: string;

    let depositAmount: BigNumber;
    let collateralAmount: BigNumber;
    let borrowedAmount: BigNumber;

    beforeEach(async () => {
        collateralApproved = config.approved[0];
        collateralToken = await ethers.getContractAt("ERC20", collateralApproved.address);

        borrowedApproved = config.approved[1];
        borrowedToken = await ethers.getContractAt("ERC20", borrowedApproved.address);

        depositAmount = ethers.BigNumber.from(10).pow(borrowedApproved.decimals).mul(50);
        collateralAmount = ethers.BigNumber.from(10).pow(collateralApproved.decimals).mul(200);
        borrowedAmount = ethers.BigNumber.from(10).pow(borrowedApproved.decimals).mul(10);

        marginLong = await ethers.getContractAt("MarginLong", config.marginLongAddress);
        pool = await ethers.getContractAt("LPool", config.leveragePoolAddress);
        oracle = await ethers.getContractAt("OracleTest", config.oracleAddress);

        lpToken = await ethers.getContractAt("ERC20", await pool.LPFromPT(borrowedToken.address));

        const priceDecimals = await oracle.priceDecimals();
        await oracle.setPrice(collateralToken.address, ethers.BigNumber.from(10).pow(priceDecimals));
        await oracle.setPrice(borrowedToken.address, ethers.BigNumber.from(10).pow(priceDecimals).mul(20));

        const signer = ethers.provider.getSigner();
        signerAddress = await signer.getAddress();

        await pool.addLiquidity(borrowedToken.address, depositAmount);

        const availableCollateral = await collateralToken.balanceOf(signerAddress);
        await marginLong.addCollateral(collateralToken.address, availableCollateral);
    });

    afterEach(async () => {
        const collateral = await marginLong.collateral(collateralToken.address, signerAddress);
        if (collateral.gt(0)) await marginLong.removeCollateral(collateralToken.address, collateral);

        const LPTokenAmount = await lpToken.balanceOf(signerAddress);
        if (LPTokenAmount.gt(0)) await pool.removeLiquidity(await pool.LPFromPT(borrowedToken.address), LPTokenAmount);
    });

    it("should borrow below the max utilization", async () => {
        const maxUtilization = await pool.maxUtilization(borrowedToken.address);
        const tempBorrowAmount = depositAmount.mul(maxUtilization[0]).div(maxUtilization[1]).div(2);
        await marginLong.borrow(borrowedToken.address, tempBorrowAmount);

        const [maxInterestMinNumerator, maxInterestMinDenominator] = await pool.maxInterestMin(borrowedToken.address);
        const [interestNumerator, interestDenominator] = await pool.interestRate(borrowedToken.address);
        expect(interestNumerator.mul(maxInterestMinDenominator).mul(2).eq(maxInterestMinNumerator.mul(interestDenominator))).to.equal(true);

        await marginLong["repayAccount(address)"](borrowedToken.address);
    });

    it("should borrow at the max utilization", async () => {
        const maxUtilization = await pool.maxUtilization(borrowedToken.address);
        const tempBorrowAmount = depositAmount.mul(maxUtilization[0]).div(maxUtilization[1]);
        await marginLong.borrow(borrowedToken.address, tempBorrowAmount);

        const [maxInterestMinNumerator, maxInterestMinDenominator] = await pool.maxInterestMin(borrowedToken.address);
        const [interestNumerator, interestDenominator] = await pool.interestRate(borrowedToken.address);
        expect(interestNumerator.mul(maxInterestMinDenominator).eq(maxInterestMinNumerator.mul(interestDenominator))).to.equal(true);

        await marginLong["repayAccount(address)"](borrowedToken.address);
    });

    it("should borrow below 100% utilization", async () => {
        const maxUtilization = await pool.maxUtilization(borrowedToken.address);

        const tempBorrowAmount = depositAmount.mul(maxUtilization[0].add(maxUtilization[1])).div(maxUtilization[1]).div(2);
        await marginLong.borrow(borrowedToken.address, tempBorrowAmount);

        const [maxInterestMinNumerator, maxInterestMinDenominator] = await pool.maxInterestMin(borrowedToken.address);
        const [maxInterestMaxNumerator, maxInterestMaxDenominator] = await pool.maxInterestMax(borrowedToken.address);
        const [interestNumerator, interestDenominator] = await pool.interestRate(borrowedToken.address);
        expect(
            interestNumerator
                .mul(maxInterestMinDenominator)
                .mul(maxInterestMaxDenominator)
                .mul(2)
                .eq(interestDenominator.mul(maxInterestMaxNumerator.mul(maxInterestMinDenominator).add(maxInterestMinNumerator.mul(maxInterestMaxDenominator))))
        ).to.equal(true);

        await marginLong["repayAccount(address)"](borrowedToken.address);
    });

    it("should borrow at 100% utilization", async () => {
        await marginLong.borrow(borrowedToken.address, depositAmount);

        const [maxInterestMaxNumerator, maxInterestMaxDenominator] = await pool.maxInterestMax(borrowedToken.address);
        const [interestNumerator, interestDenominator] = await pool.interestRate(borrowedToken.address);
        expect(interestNumerator.mul(maxInterestMaxDenominator).eq(maxInterestMaxNumerator.mul(interestDenominator))).to.equal(true);

        await marginLong["repayAccount(address)"](borrowedToken.address);
    });

    it("should accumulate interest over the given year as according to the rate", async () => {
        await marginLong.borrow(borrowedToken.address, depositAmount);

        const [interestNumerator, interestDenominator] = await pool.interestRate(borrowedToken.address);
        const timePerInterestApplication = await pool.timePerInterestApplication();
        await wait(timePerInterestApplication);

        const interest = await marginLong["interest(address,address)"](borrowedToken.address, signerAddress);
        const initialBorrowPrice = await marginLong["initialBorrowPrice(address,address)"](borrowedToken.address, signerAddress);

        expect(interest.eq(initialBorrowPrice.mul(interestNumerator).div(interestDenominator))).to.equal(true);
        expect((await marginLong.accountPrice(signerAddress)).eq((await marginLong.collateralPrice(signerAddress)).sub(interest))).to.equal(true);

        await marginLong["repayAccount(address)"](borrowedToken.address);
    });

    it("should accumulate the given interest first before borrowing more", async () => {
        // **** TODO Maybe standardize the leverage amount in ALL of the borrow tests just like I did for the previous one to make sure it always works properly + deposit the total balance worth for max leverage

        await marginLong.borrow(borrowedToken.address, depositAmount.div(2));

        const [initialInterestRateNumerator, initialInterestRateDenominator] = await pool.interestRate(borrowedToken.address);
        const timePerInterestApplication = await pool.timePerInterestApplication();
        await wait(timePerInterestApplication);
        const initialInterest = await marginLong["interest(address,address)"](borrowedToken.address, signerAddress);

        await marginLong.borrow(borrowedToken.address, depositAmount.div(2));

        const [currentInterestRateNumerator, currentInterestRateDenominator] = await pool.interestRate(borrowedToken.address);
        await wait(timePerInterestApplication);
        const currentInterest = await marginLong["interest(address,address)"](borrowedToken.address, signerAddress);

        expect(currentInterestRateNumerator.mul(initialInterestRateDenominator).eq(initialInterestRateNumerator.mul(currentInterestRateDenominator))).to.equal(false);

        const initialBorrowPrice = await marginLong["initialBorrowPrice(address,address)"](borrowedToken.address, signerAddress);
        expect(currentInterest.eq(initialInterest.add(initialBorrowPrice.mul(currentInterestRateNumerator).div(currentInterestRateDenominator))));

        await marginLong["repayAccount(address)"](borrowedToken.address);
    });
});
