// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Exchange is ERC20 {

    address public cryptoDevTokenAddress;

    //Exchange is inheriting ERC20 because exchange would keep track of Crypto Dev LP tokens
    constructor(address _CryptoDevToken) ERC20("CryptoDev LP Token", "CDLP") {
        require(_CryptoDevToken != address(0), "Token address passed is a null address");
        cryptoDevTokenAddress = _CryptoDevToken;
    }

    // @dev Returns the reserve amount if Crypto Dev Tokens held by the contract
    // no need for function to get Eth balance -- can just be called using address(this).balance
    function getReserve() public view returns (uint) {
        return ERC20(cryptoDevTokenAddress).balanceOf(address(this));
    }

    //@dev Adds liquidity to contract
    function addLiquidity(uint _amount) public payable returns (uint) {
        uint liquidity;
        uint ethBalance = address(this).balance;
        uint cryptoDevTokenReserve = getReserve();
        ERC20 cryptoDevToken = ERC20(cryptoDevTokenAddress);
        /*
        If reserve is empty, intake any user supplied value for 'Ether' and 'Crypto Dev' tokens
        beause there is currently no ratio
        */
        if(cryptoDevTokenReserve == 0) {
            // transfer the 'cryptoDevToken' from the user's account to contract
            cryptoDevToken.transferFrom(msg.sender, address(this), _amount);
            // take current ethBalance and mint 'ethBalance' amount of LP tokens to the user
            // 'liquidity' provided is equal to 'ethBalance' because this is the first time user is adding Eth to the contract
            // whatever Eth contract has is equal to the one supplied by the user in corrent 'addLiquidity' call
            //'liquidity' tokens that need to be minted to user on 'addLiquidity' call should always be proportional
            // to eth specified by user
            liquidity = ethBalance;
            _mint(msg.sender, liquidity);
        } else {
            /*
            if reserve is not empty, intake any user supplied value and determine according 
            to the ration how many Crypto Dev tokens need to be supplied to prevent large price impacts
            */
            // EthReserve should be the current ethBalance subtracted by the value of ether sent by the user
            // subtract because ethBalance is updated with users current call msg.value. need previous amount before this call
            uint ethReserve = ethBalance - msg.value;
            // ratio should always be maintained so that there are no major price impacts when adding liquidity
            // ratio -> (cryptoDevTokenAmount user can add/cryptoDevTokenReserve in the contract) = (Eth Sent by the user/Eth Reserve in the contract);
            // ratio -> (cryptoDevTokenAmount user can add) = (Eth Sent by user * cryptoDevTokenReserve/ Eth Reserve)
            uint cryptoDevTokenAmount = (msg.value * cryptoDevTokenReserve / ethReserve);
            require(_amount >= cryptoDevTokenAmount, "Amount sent is less than the minimum tokens required");
            // transfer only (cryptoDevTokenAmount user can add) amount of 'Crypto Dev tokens' from users account to the contract
            cryptoDevToken.transferFrom(msg.sender, address(this), cryptoDevTokenAmount);
            // the amount of LP tokens that would be sent to user would be proportional to the liquidity of ether added by user
            // ratio -> (LP tokens to be sent to the user(liquidity)/ totalSupply of LP tokens in contract) = (eth sent by the user)/(eth reserve in the contract)
            // -> liquidity = (totalSupply of LP tokens in contract * (eth sent by the user))/(eth reserve in the contract)
            liquidity =(totalSupply() * msg.value) / ethReserve; //total supply from ERC20 contract
            _mint(msg.sender, liquidity);
        }
        return liquidity;
    }

    /**
    @dev returns the amount of Eth/Crypto Dev tokens that would be returned to the user in the swap
     */
    function removeLiquidity(uint _amount) public returns (uint, uint) {
        require(_amount > 0, "amount should be greaer than zero");
        uint ethReserve = address(this).balance;
        uint _totalSupply = totalSupply();
        // amount of Eth sent back to user based on a ratio
        // ratio -> (Eth sent back to user/current Eth reserve) = (amount of LP tokens user wants to withdraw / total LP token supply)
        // (Eth back to user) = (current Eth reserve * amount of LP tokens user wants to withdraw) / total LP token supply
        uint ethAmount = (ethReserve * _amount) / _totalSupply;
        // amount of CD tokens sent back to user based on ratio
        // ratio -> (CD sent back to user/current CD reserve) = (amount of LP tokens user wants to withdraw / total LP token supply)
        // (CD back to user) = (current CD reserve * amount of LP tokens user wants to withdraw) / total LP token supply
        uint cryptoDevTokenAmount = (getReserve() * _amount)/ _totalSupply;
        // burn the sent 'LP' tokens from the users wallet because already sent to remove liquidity
        _burn(msg.sender, _amount);
        // transfer 'ethAmount' of Eth from contract to users wallet
        payable(msg.sender).transfer(ethAmount);
        // transfer 'cryptoDevTokenAmount' of CD tokens from contract to users wallet
        ERC20(cryptoDevTokenAddress).transfer(msg.sender, cryptoDevTokenAmount);
        return (ethAmount, cryptoDevTokenAmount);
    }

    /**
    @dev returns the amount of Eth/CD tokens that would be returned to the user in the swap
    input = token to sell, output = token to receive
    */
    function getAmountOfTokens(uint256 inputAmount, uint256 inputReserve, uint256 outputReserve) public pure returns (uint256) {
        require(inputReserve > 0 && outputReserve > 0, "invalid reserves");
        // charging fee of 1%
        // Input amount with fees = (input amount - (1*(input amount)/100)) = ((input amount)*99)/100
        uint256 inputAmountWithFee = inputAmount * 99;
        // follow concept of 'XY = k' curve
        // ensure (x + dx)*(y-dy) = x*y
        // final formulae is dy = (y*dx)/(x+dx)
        // dy = tokens to be received
        // dx = ((input amount)*99)/100, x = inputReserve, y= outputReserve
        uint256 numerator = inputAmountWithFee * outputReserve;
        uint256 denominator = (inputReserve * 100) + inputAmountWithFee;
        return numerator / denominator;
    }

    /**
    @dev Swaps Ether for CD tokens 
    */
    function ethToCryptoDevToken(uint _minTokens) public payable {
        uint256 tokenReserve = getReserve();
        // call getAmountOfTokens to get amount of CD tokens that would be retruned to the user after the swap
        // inputReserve = address(this).balance - msg.value 
        // because balance is already updated with current user call
        uint256 tokensBought = getAmountOfTokens(
            msg.value, 
            address(this).balance - msg.value,
            tokenReserve
        );

        require(tokensBought >= _minTokens, "insufficient output amount");
        // Transfer CD tokens to user
        ERC20(cryptoDevTokenAddress).transfer(msg.sender, tokensBought);
    }

    /**
    @dev Swaps CD token for Eth 
    */
    function cryptoDevTokenToEth(uint _tokensSold, uint _minEth) public {
        uint256 tokenReserve = getReserve();
        // call getAmountOfTokens to get the amount of ether that would be returned to user after swap
        uint256 ethBought = getAmountOfTokens(
            _tokensSold,
            tokenReserve, 
            address(this).balance
        );
        require(ethBought >= _minEth, "insufficient output amount");
        // Transfer CD to contract from users address
        ERC20(cryptoDevTokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokensSold
        );
        // send 'ethBought' to user from contract
        payable(msg.sender).transfer(ethBought);
    }
}