import { Contract, utils } from "ethers";
import {
    EXCHANGE_CONTRACT_ABI,
    EXCHANGE_CONTRACT_ADDRESS,
    TOKEN_CONTRACT_ABI,
    TOKEN_CONTRACT_ADDRESS,
} from "../constants";

/**
 * addLiquidity adds liq to the exchange
 * if user is adding initial liquidity, user decides the eth and CD they want to add to exchange
 * if adding after initial is added, then we caluclate the CD tokens they can add given the eth they want to add by keeping ratio constant
 */
export const addLiquidity = async (signer, addCDAmountWei, addEtherAmountWei) => {
    try {
        const tokenContract = new Contract(
            TOKEN_CONTRACT_ADDRESS,
            TOKEN_CONTRACT_ABI,
            signer
        );
        const exchangeContract = new Contract(
            EXCHANGE_CONTRACT_ADDRESS,
            EXCHANGE_CONTRACT_ABI,
            signer
        );
        //CD tokens are ERC20, user will need to give contract allowance take required number of CD tokens from wallet
        let tx = await tokenContract.approve(
            EXCHANGE_CONTRACT_ADDRESS,
            addCDAmountWei.toString()
        );
        await tx.wait();
        //after the contract has the approval, add the ether and cd tokens in the liquidity
        tx = await exchangeContract.addLiquidity(addCDAmountWei, {
            value: addEtherAmountWei,
        });
        await tx.wait();
    } catch (err) {
        console.error(err);
    }
};

/**
 * calculateCD calculates the CD tokens that need to be added to the liquidity
 * given '_addEtherAmountWei' amount of ether
 */
export const calculateCD = async (_addEther = "0", etherBalanceContract, cdTokenReserve) => {
    //'_addEther' is a string, need to covert to BigNumber before doing calculations
    // use 'parseEther' function from ethers.js
    const _addEtherAmountWei = utils.parseEther(_addEther);
    // ratio needs to be maintained when we add liquidity
    // need to let user know specific amount of ether and CD tokens that can be added
    // ratio: (Amount of CD tokens to be added)/(CD tokens balance) = (Ether that would be added)/ (Eth reseve in the contract)
    // -> (Amount of CD tokens to be added) = (Ether that would be added*CD tokens balance)/ (Eth reseve in the contract)
    const cryptoDevTokenAmount = _addEtherAmountWei
        .mul(cdTokenReserve)
        .div(etherBalanceContract);
    return cryptoDevTokenAmount;
};

