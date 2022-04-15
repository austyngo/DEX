import { Contract } from "ethers";
import {
    EXCHANGE_CONTRACT_ABI,
    EXCHANGE_CONTRACT_ADDRESS,
    TOKEN_CONTRACT_ABI,
    TOKEN_CONTRACT_ADDRESS,
} from "../constants";

/**
 * getAmountOfTokensReceivedFromSwap: returns number of eth/CD tokens that can be received when the user swaps
 * '_swapAmountWei' amount of Eth/CD tokens
 */
export const getAmountOfTokensReceivedFromSwap = async (_swapAmountWei, provider, ethSelected, ethBalance, reserveCD) => {
    // create new instance of exchange contract
    const exchangeContract = new Contract(
        EXCHANGE_CONTRACT_ADDRESS,
        EXCHANGE_CONTRACT_ABI,
        provider
    );
    let amountOfTokens;
    // if Eth selected then input amount would be _swapAmountWei, input reserve -> ethBalance, output reserve -> reserveCD
    if (ethSelected) {
        amountOfTokens = await exchangeContract.getAmountOfTokens( //getAmountOfTokens returs output amount from ratio
            _swapAmountWei,
            ethBalance,
            reserveCD
        );
    } else {
        // if eth not selected, input value is CD token, input amount -> _swapAmountWei
        // input reserve -> reserveCD, output reserve -> ethBalance
        amountOfTokens = await exchangeContract.getAmountOfTokens(
            _swapAmountWei,
            reserveCD,
            ethBalance
        );
    }
    return amountOfTokens;
};

export const swapTokens = async (signer, swapAmountWei, tokenToBeReceivedAfterSwap, ethSelected) => {
    const exchangeContract = new Contract(
        EXCHANGE_CONTRACT_ADDRESS,
        EXCHANGE_CONTRACT_ABI,
        signer
    );
    const tokenContract = new Contract(
        TOKEN_CONTRACT_ADDRESS,
        TOKEN_CONTRACT_ABI,
        signer
    );
    let tx;
    // if eth selected, call 'ethToCryptoDevToken' function
    // else call 'cryptoDevTokenToEth' function from contract
    // pass 'swapAmount' as a value to the function because it is the ether we are paying to the contract,
    // instead of a value we are passing to the function
    if (ethSelected) {
        tx = await exchangeContract.ethToCryptoDevToken(
            tokenToBeReceivedAfterSwap,
            {
                value: swapAmountWei,
            }
        );
    } else {
        // user has to approve 'swapAmountWei' for the contract because CD token is ERC20
        tx = await tokenContract.approve(
            EXCHANGE_CONTRACT_ADDRESS,
            swapAmountWei.toString()
        );
        await tx.wait();
        // call cryptoDevTOkenToEth function which would take 'swapAmountWei' of CD tokens and 
        // send back 'tokenToBeReceivedAfterSwap' amount of ether to user
        tx = await exchangeContract.cryptoDevTokenToEth(
            swapAmountWei,
            tokenToBeReceivedAfterSwap
        );
    }
    await tx.wait();
};