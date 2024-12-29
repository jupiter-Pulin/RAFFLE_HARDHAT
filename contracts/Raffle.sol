// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
//1.彩票系统，大家能进去投钱，每人固定只能投一样的钱，但可以重复多投入。创建一个玩家数组
//2.通过生成一个随机数，然后让这个随机数与我的玩家数组索引相同
//3.每隔固定时间，合约会自动刷新，并刷掉之前的玩家序列，重新开始积攒奖金

/*
* @title A sample Raffle Contract
* @Author Pulin
* @dev implement the chainlink VRF2.5 and AutoMation
*/
contract Raffle is VRFConsumerBaseV2Plus,AutomationCompatibleInterface{
    enum RaffleState{
        OPEN,
        CALCULATING
    }
 
    
    /*state variable*/
    uint256 private immutable i_enterFee;
    address[] private s_playersArray;
    uint256 private s_subscriptionId;
    address immutable i_vrfCoordinator ;
    bytes32 private s_keyHash ;
    uint32 private immutable i_callbackGasLimit;
    uint16 constant REQUEST_CONFIRMATION = 3;
    uint32 constant NUM_WORD =  1;
    uint256 private randomWords;
    address private  s_recentWinner;
    bool immutable i_enableNativePayment;
    uint256 private s_timeStamp;
    address private immutable i_owner;
    uint256 private immutable i_interval;
    RaffleState raffleStateEnum;
    uint256 constant TARGET=1*10**9;

    /*Event*/
    event RaffleEnter(address indexed players);
    event WinnerPicked(address);
    //event WordsRandomRequest(uint256);
    constructor(
        uint256 enterFee,
        uint256 subscriptionId,
        bool enableNativePayment,
        uint256 interval,
        address vrfCoordinator,
        bytes32 keyHash,uint32 callbackGasLimit
        )
        VRFConsumerBaseV2Plus(vrfCoordinator)
        {
        i_enterFee=enterFee;
        s_subscriptionId=subscriptionId;
        i_enableNativePayment=enableNativePayment;
        i_owner=msg.sender;
        s_timeStamp=block.timestamp;
        i_interval=interval;
        raffleStateEnum=RaffleState.OPEN;
        i_callbackGasLimit=callbackGasLimit;
        i_vrfCoordinator=vrfCoordinator;
        s_keyHash=keyHash;
        
    }

    /*function*/
    function enterRaffle()public payable {
        require(msg.value >= i_enterFee,"pleace send at least one enterFee");
        require(raffleStateEnum==RaffleState.OPEN,"the raffle is not open");
        s_playersArray.push(msg.sender);
        emit RaffleEnter(msg.sender);
    }
     /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval has passed between raffle runs.
     * 2. The lottery is open.
     * 3. The contract has ETH.
     * 4. Implicity, your subscription is funded with LINK.
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public 
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        //1.确认超过了一个时间间隔 interval 
        bool timePassed=(block.timestamp-s_timeStamp>i_interval);
        //2.确保状态是开启的
        bool isOpen=(raffleStateEnum==RaffleState.OPEN);
        //3.确保有玩家数量
        bool hasPlayers=(s_playersArray.length>0);
        //4.确保投入目标金额
        bool getTarget=(address(this).balance>=TARGET);
        upkeepNeeded=(timePassed && isOpen && hasPlayers && getTarget);
        return (upkeepNeeded, "0x"); // can we comment this out?
    }
    function performUpkeep(bytes calldata /* performData */) external  override  {
        (bool upkeepNeeded,) = checkUpkeep("0x");
        require(upkeepNeeded, "upkeepNeeded now is false");
        raffleStateEnum=RaffleState.CALCULATING;
        uint256 requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATION,
                callbackGasLimit: i_callbackGasLimit,
                numWords: NUM_WORD,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({
                        nativePayment: i_enableNativePayment
                    })
                )
            })
        );
       
        //因为在s_vrfCoordinator.requestRandomWords，这个函数已经在vrfCoordinator这个合约中调用了一个事件，叫RandomWordsRequested
    }
    
        
    function fulfillRandomWords(
        uint256 /*_requestId*/,
        uint256[] calldata _randomWords
    ) internal override{
        
        randomWords=_randomWords[0];
        uint256 winIndex=randomWords % s_playersArray.length;
        s_recentWinner=s_playersArray[winIndex];
        bool success;
        (success,)=payable (s_recentWinner).call{value: address(this).balance}("");
        require(success,"the call function is no in used");
        s_playersArray=new address[](0);
        raffleStateEnum=RaffleState.OPEN;
        s_timeStamp=block.timestamp;
        emit WinnerPicked(s_recentWinner);
    }
    
    
    /*view pure function*/
    function enterFeeToRaffle()public view returns (uint256){
        return i_enterFee;
    }
    function getPlayers(uint256 index)public view returns (address){
        return s_playersArray[index];
    }  
    function getConfirmation()public pure  returns (uint16){
        return REQUEST_CONFIRMATION;
    }
    function getRandomWords()public view returns(uint256){
        return randomWords;
    }
    function getRecentWinner()public view returns (address){
        return s_recentWinner;
    }
    function getInterval()public view returns (uint256){
        return i_interval;
    }
    function getRuffleTarget()public pure returns (uint256){
        return TARGET;
    }
    function getNumberofPlayers()public view returns (uint256){
        return s_playersArray.length;
    }
    function getRaffleState()public view returns (RaffleState){
        return raffleStateEnum;
    }
    function getEnableNativePayment()public view returns (bool){
        return i_enableNativePayment;
    }
    function getLatestTimeStamp()public view returns (uint256){
        return s_timeStamp;
    }
    function getContractBalance()public view returns(uint256){
        uint256 balance=address(this).balance;
        return balance;
    }
}