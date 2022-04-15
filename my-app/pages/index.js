import { BigNumber, providers, utils } from "ethers";
import Head from "next/head";
import React, { useEffect, useRef, useState } from "react";
import Web3Modal from "web3modal";
import styles from "../styles/Home.module.css";
import { addLiquidity, calculateCD } from "../utils/addLiquidity"; 
import { 
    getCDTokensBalance,
    getEtherBalance,
    getLPTokensBalance,
    getReserveOfCDTokens,
} from "../utils/getAmount";
import { getTokensAfterRemove, removeLiquidity } from "../utils/removeLiquidity";
import { swapTokens, getAmountOfTokensReceivedFromSwap } from "../utils/swap";

export default function Home() {
    // general state variables
    // loading - true when transaction is processing
    const [loading, setLoading] = useState(false);
    // two tabs - liquidity tab and swap tab - this keeps track of which tab user is on
    // true when on liquidity tab
    const [liquidityTab, setLiquidityTab] = useState(true);
    // '0' in the form of a BigNumber
    const zero = BigNumber.from(0);
    // variables to keep track of amount
    // amount of eth in user's wallet
    const [ethBalance, setEtherBalance] = useState(zero);
    // CD tokens reserve in exchange contract
    const [reservedCD, setReservedCD] = useState(zero);
    // eth balance in contract
    const [etherBalanceContract, setEtherBalanceContract] = useState(zero);
    // cd token balance of users wallet
    const [cdBalance, setCDBalance] = useState(zero);
    // lp token balance of user
    const [lpBalance, setLPBalance] = useState(zero);
    // variables to keep track of liquidity to be added or removed
    // amount of ether user wants to add to liquidity
    const [addEther, setAddEther] = useState(zero);
    //amount of CD tokens user wants to add to liquidity
    // keeps track of CD tokens user can add given amount of ether
    const [addCDTokens, setAddCDTokens] = useState(zero);
    // amount of eth that would be sent back to user based on LP tokens to withdraw
    const [removeEther, setRemoveEther] = useState(zero);
    // amount of CD tokens that would be sent back to the user based on number of LP tokens to withdraw
    const [removeCD, setRemoveCD] = useState(zero);
    // amount of LP tokens that the user wants to remove from liquidity
    const [removeLPTokens, setRemoveLPTokens] = useState("0");
    /** Variables to keep track of swap functionality */
    // Amount that the user wants to swap
    const [swapAmount, setSwapAmount] = useState("");
    // This keeps track of the number of tokens that the user would recieve after a swap completes
    const [tokenToBeRecievedAfterSwap, setTokenToBeRecievedAfterSwap] = useState(zero);
    // Keeps track of whether  `Eth` or `Crypto Dev` token is selected. If `Eth` is selected it means that the user
    // wants to swap some `Eth` for some `Crypto Dev` tokens and vice versa if `Eth` is not selected
    const [ethSelected, setEthSelected] = useState(true);
    /** Wallet connection */
    // Create a reference to the Web3 Modal (used for connecting to Metamask) which persists as long as the page is open
    const web3ModalRef = useRef();
    // walletConnected keep track of whether the user's wallet is connected or not
    const [walletConnected, setWalletConnected] = useState(false);

    /**
     * call various functions to retreive amounts for ethBalance, LP tokens etc
     */
    const getAmounts = async () => {
        try {
            const provider = await getProviderOrSigner(false);
            const signer = await getProviderOrSigner(true);
            const address = await signer.getAddress();
            // get eth amount from users wallet
            const _ethBalance = await getEtherBalance(provider, address);
            // get CD token amount from user wallet
            const _cdBalance = await getCDTokensBalance(provider, address);
            // get lp token balance from users wallet
            const _lpbalance = await getLPTokensBalance(provider, address);
            // get CD token balance in exchange contract reserve
            const _reservedCD = await getReserveOfCDTokens(provider);
            // get eth reserve of contract
            const _ethBalanceContract = await getEtherBalance(provider, null, true); //when third var is true, get balance from contract
            setEtherBalance(_ethBalance);
            setCDBalance(_cdBalance);
            setLPBalance(_lpbalance);
            setReservedCD(_reservedCD);
            setEtherBalanceContract(_ethBalanceContract); 
        } catch (err) {
            console.error(err);
        }
    };

    /**** Swap Functions ****/

    /**
     * swaps ' swapAmountWei' of Eth/CD with 'tokenTOBeReceivedAfterSwap' amount of Eth/CD
     */
    const _swapTokens = async () => {
        try {
            // convert amount to bignumber using parseEther
            const swapAmountWei = utils.parseEther(swapAmount);
            // check id user entered zero
            // using the 'eq' method from bigNumber class in ethers.js
            if (!swapAmountWei.eq(zero)) {
                const signer = await getProviderOrSigner(true);
                setLoading(true);
                // call swapTokens func from utils folder
                await swapTokens(
                    signer,
                    swapAmountWei,
                    tokenToBeRecievedAfterSwap, // set in next function
                    ethSelected
                );
                setLoading(false);
                // get all updated amounts after the swap
                await getAmounts();
                setSwapAmount("") //swap amount is user input, reset to blank after swap
            }
        } catch (err) {
            console.error(err);
            setLoading(false);
            setSwapAmount("");
        }
    };

    /**
     * Returns number of Eth/CD that can be received when the user swaps '_swapAmountWEI' amount of ETH/CD
     */
     const _getAmountOfTokensReceivedFromSwap = async (_swapAmount) => {
        try {
            // convert amount entered by user to Bignumber using parseEther
            const _swapAmountWEI = utils.parseEther(_swapAmount.toString());
            // check if user entered zero
            // using eq method from bignumber class in ethers.js
            if (!_swapAmountWEI.eq(zero)) {
                const provider = await getProviderOrSigner();
                // get amount of eth in contract
                const _ethBalance = await getEtherBalance(provider, null, true);
                const amountOfTokens = await getAmountOfTokensReceivedFromSwap(
                    _swapAmountWEI,
                    provider,
                    ethSelected,
                    _ethBalance,
                    reservedCD
                );
                setTokenToBeRecievedAfterSwap(amountOfTokens);
            } else {
                setTokenToBeRecievedAfterSwap(zero);
            }
        } catch (err) {
            console.error(err);
        }
    };
    
    /*** ADD LIQUIDITY FUNCTIONS ***/

    /**
     * add liquidity to exchange
     * if user adding initial liquidity, user decides the eth and CD he wants to add
     * if adding after there is already liquidity, then calculate the amount of CD to add given eth added to maintain ratio
     */
    const _addLiquidity = async () => {
        try {
            // convert eth amount to BigNumber
            const addEtherWei = utils.parseEther(addEther.toString());
            // check if values are zero
            if (!addCDTokens.eq(zero) && !addEtherWei.eq(zero)) {
                const signer = await getProviderOrSigner(true);
                setLoading(true);
                //call addLiquidity from utils folder
                await addLiquidity(signer, addCDTokens, addEtherWei);
                setLoading(false);
                //reinitialize CD tokens
                setAddCDTokens(zero);
                // get amounts for all values after liquidity has been added
                await getAmounts();
            } else {
                setAddCDTokens(zero);
            }
        } catch (err) {
            console.error(err);
            setLoading(false);
            setAddCDTokens(zero);
        }
    };

    /*** REMOVE LIQUIDITY FUNCTIONS  ***/

    /**
     * _removeLiquidity - removes 'removeLPTokensWei' amount of LP Tokens
     * from liquidty and also the calculated amount of eth and CD
     */

    const _removeLiquidity = async () => {
        try {
            const signer = await getProviderOrSigner(true);
            const removeLPTokensWei = utils.parseEther(removeLPTokens);
            setLoading(true);
            // call removeLiquidity function from utils folder
            await removeLiquidity(signer, removeLPTokensWei);
            setLoading(false);
            await getAmounts();
            setRemoveCD(zero);
            setRemoveEther(zero);
        } catch (err) {
            console.error(err);
            setLoading(false);
            setRemoveCD(zero);
            setRemoveEther(zero);
        }
    };

    /**
     * _getTokensAfterRemove - calculates the amount of eth and CD that would be
     * returned back to user after removing LP tokens
     */
    const _getTokensAfterRemove = async (_removeLPTokens) => {
        try {
            const provider = await getProviderOrSigner();
            // convert to BigNumber
            const removeLPTokensWei = utils.parseEther(_removeLPTokens);
            // get eth reserves from exchange contract
            const _ethBalance = await getEtherBalance(provider, null, true);
            //get CD reserves from exchance contract
            const cryptoDevTokenReserve = await getReserveOfCDTokens(provider);
            // call the getTokensAfterRemove from the utils folder
            const { _removeEther, _removeCD } = await getTokensAfterRemove(provider, removeLPTokensWei, _ethBalance, cryptoDevTokenReserve);
            setRemoveEther(_removeEther);
            setRemoveCD(_removeCD);
        } catch (err) {
            console.error(err);
        }
    };

    /*
    connectWallet: Connects the MM wallet
    */
    const connectWallet = async () => {
        try {
            await getProviderOrSigner();
            setWalletConnected(true);
        } catch (err) {
            console.error(err);
        }
    };

   //function to get provider or signer
   //@param (*) needSigner - True if needs signer, false otherwise
    const getProviderOrSigner = async (needSigner = false) => {
        // connect to MM
        // since store 'web3Modal' as a ref, need to access the 'current' value to get access to underlying object
        // current is set in useEffect below
        const provider = await web3ModalRef.current.connect();
        const web3Provider = new providers.Web3Provider(provider);

        //if user is not connected to rinkeby network, let them know and throw err
        const { chainId } = await web3Provider.getNetwork();
        if (chainId != 4) {
            window.alert("Change network to Rinkeby");
            throw new Error("Change network to Rinkeby");
        }

        if (needSigner) {
            const signer = web3Provider.getSigner();
            return signer;
        }
        return web3Provider;
   };

   // useEffects are used to react to changes in state of website
   // array at end of function call represents what state changes will trigger this effect
   // in this case, whenever values of 'walletConnected' changes - this effect will be called
    useEffect(() => {
        if (!walletConnected) {
            // assign web3Modal class to ref object by setting its 'current' value
            // 'current' values is persisted throughout as long as this page is open
            web3ModalRef.current = new Web3Modal({
                network: "rinkeby",
                providerOptions: {},
                disableInjectedProvider: false,
            });
            connectWallet();
            getAmounts();
        }
    }, [walletConnected]);

   /*
   renderButton: returns a button based on state of DApp
   */
   const renderButton = () => {
    // If wallet is not connected, return a button which allows them to connect their wllet
    if (!walletConnected) {
      return (
        <button onClick={connectWallet} className={styles.button}>
          Connect your wallet
        </button>
      );
    }

    // If we are currently waiting for something, return a loading button
    if (loading) {
      return <button className={styles.button}>Loading...</button>;
    }

    if (liquidityTab) {
      return (
        <div>
          <div className={styles.description}>
            You have:
            <br />
            {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
            {utils.formatEther(cdBalance)} Crypto Dev Tokens
            <br />
            {utils.formatEther(ethBalance)} Ether
            <br />
            {utils.formatEther(lpBalance)} Crypto Dev LP tokens
          </div>
          <div>
            {/* If reserved CD is zero, render the state for liquidity zero where we ask the user
            who much initial liquidity he wants to add else just render the state where liquidity is not zero and
            we calculate based on the `Eth` amount specified by the user how much `CD` tokens can be added */}
            {utils.parseEther(reservedCD.toString()).eq(zero) ? (
              <div>
                <input
                  type="number"
                  placeholder="Amount of Ether"
                  onChange={(e) => setAddEther(e.target.value || "0")}
                  className={styles.input}
                />
                <input
                  type="number"
                  placeholder="Amount of CryptoDev tokens"
                  onChange={(e) =>
                    setAddCDTokens(
                      BigNumber.from(utils.parseEther(e.target.value || "0"))
                    )
                  }
                  className={styles.input}
                />
                <button className={styles.button1} onClick={_addLiquidity}>
                  Add
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="number"
                  placeholder="Amount of Ether"
                  onChange={async (e) => {
                    setAddEther(e.target.value || "0");
                    // calculate the number of CD tokens that
                    // can be added given  `e.target.value` amount of Eth
                    const _addCDTokens = await calculateCD(
                      e.target.value || "0",
                      etherBalanceContract,
                      reservedCD
                    );
                    setAddCDTokens(_addCDTokens);
                  }}
                  className={styles.input}
                />
                <div className={styles.inputDiv}>
                  {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                  {`You will need ${utils.formatEther(addCDTokens)} Crypto Dev
                  Tokens`}
                </div>
                <button className={styles.button1} onClick={_addLiquidity}>
                  Add
                </button>
              </div>
            )}
            <div>
              <input
                type="number"
                placeholder="Amount of LP Tokens"
                onChange={async (e) => {
                  setRemoveLPTokens(e.target.value || "0");
                  // Calculate the amount of Ether and CD tokens that the user would recieve
                  // After he removes `e.target.value` amount of `LP` tokens
                  await _getTokensAfterRemove(e.target.value || "0");
                }}
                className={styles.input}
              />
              <div className={styles.inputDiv}>
                {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
                {`You will get ${utils.formatEther(removeCD)} Crypto
              Dev Tokens and ${utils.formatEther(removeEther)} Eth`}
              </div>
              <button className={styles.button1} onClick={_removeLiquidity}>
                Remove
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <input
            type="number"
            placeholder="Amount"
            onChange={async (e) => {
              setSwapAmount(e.target.value || "");
              // Calculate the amount of tokens user would recieve after the swap
              await _getAmountOfTokensReceivedFromSwap(e.target.value || "0");
            }}
            className={styles.input}
            value={swapAmount}
          />
          <select
            className={styles.select}
            name="dropdown"
            id="dropdown"
            onChange={async () => {
              setEthSelected(!ethSelected);
              // Initialize the values back to zero
              await _getAmountOfTokensReceivedFromSwap(0);
              setSwapAmount("");
            }}
          >
            <option value="eth">Ethereum</option>
            <option value="cryptoDevToken">Crypto Dev Token</option>
          </select>
          <br />
          <div className={styles.inputDiv}>
            {/* Convert the BigNumber to string using the formatEther function from ethers.js */}
            {ethSelected
              ? `You will get ${utils.formatEther(
                  tokenToBeRecievedAfterSwap
                )} Crypto Dev Tokens`
              : `You will get ${utils.formatEther(
                  tokenToBeRecievedAfterSwap
                )} Eth`}
          </div>
          <button className={styles.button1} onClick={_swapTokens}>
            Swap
          </button>
        </div>
      );
    }
  };

  return (
    <div>
      <Head>
        <title>Crypto Devs</title>
        <meta name="description" content="Exchange-Dapp" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs Exchange!</h1>
          <div className={styles.description}>
            Exchange Ethereum &#60;&#62; Crypto Dev Tokens
          </div>
          <div>
            <button
              className={styles.button}
              onClick={() => {
                setLiquidityTab(!liquidityTab);
              }}
            >
              Liquidity
            </button>
            <button
              className={styles.button}
              onClick={() => {
                setLiquidityTab(false);
              }}
            >
              Swap
            </button>
          </div>
          {renderButton()}
        </div>
        <div>
          <img className={styles.image} src="./cryptodev.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
    
}   
