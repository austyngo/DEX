import { Contract, providers, utils, BigNumber } from "ethers";
import {
    EXCHANGE_CONTRACT_ABI, EXCHANGE_CONTRACT_ADDRESS
} from "../constants";

/**
 * removeLiquidity: removes the 'removeLPTokensWei' amount of LP tokens from liquidity
 * and also the calculated amount of 'ether' and CD tokens
 */
export const removeLiquidity = async (signer, removeLPTokensWei) => {
    const exchangeContract = new Contract(
        EXCHANGE_CONTRACT_ADDRESS,
        EXCHANGE_CONTRACT_ABI,
        signer
    );
    const tx = await exchangeContract.removeLiquidity(removeLPTokensWei);
    await tx.wait();
};

/**
 * getTokensAfterRemove: calc amount of 'ether' and 'CD' tokens that would be returned back to user
 * after removing LP tokens from the contract
 */
export const getTokensAfterRemove = async (provider, removeLPTokenWei, _ethBalance, cryptoDevTokenReserve) => {
    try {
        const exchangeContract = new Contract(
            EXCHANGE_CONTRACT_ADDRESS,
            EXCHANGE_CONTRACT_ABI,
            provider
        );
        // get total suppply of CD LP tokens
        const _totalSupply = await exchangeContract.totalSupply();
        // using BigNumber methods of mult and div
        // amount of eth sent backt o user after withdrawing LP token based on ratio
        // Ratio is -> (amount of ether that would be sent back to the user/ Eth reserves) = (LP tokens withdrawn)/(Total supply of LP tokens)
        // -> (amount of ether that would be sent back to the user) = (Eth Reserve * LP tokens withdrawn)/(Total supply of LP tokens)
        // also maintain a ratio for CD tokens
        // Ratio is -> (amount of CD tokens sent back to the user/ CD Token reserve) = (LP tokens withdrawn)/(Total supply of LP tokens)
        // Then (amount of CD tokens sent back to the user) = (CD token reserve * LP tokens withdrawn)/(Total supply of LP tokens)
        const _removeEther = _ethBalance
            .mul(removeLPTokenWei)
            .div(_totalSupply);
        const _removeCD = cryptoDevTokenReserve
            .mul(removeLPTokenWei)
            .div(_totalSupply);
        return {
            _removeEther,
            _removeCD,
        };
    } catch (err) {
        console.error(err);
    }
};