// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Test dollars have no monetary value and are not Circle USDC.
contract MainstreetTestDollar is ERC20 {
    mapping(address => uint256) public nextFaucetAt;
    constructor() ERC20("Mainstreet Test Dollar", "mUSD") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function faucet() external {
        require(block.timestamp >= nextFaucetAt[msg.sender], "Faucet: available once daily");
        nextFaucetAt[msg.sender] = block.timestamp + 1 days;
        _mint(msg.sender, 10_000 * 1e6);
    }
}

/// @notice Fully funded immutable allocations. Administrators cannot reclaim a holder's allocation.
contract MainstreetDistributions is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable asset;
    address public immutable treasury;
    struct Epoch { uint256 total; uint256 claimed; uint256 snapshotBlock; uint256 createdAt; string memo; }
    Epoch[] private epochs;
    mapping(uint256 => mapping(address => uint256)) public allocation;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(address => uint256) public allocatedTotal;
    mapping(address => uint256) public claimedTotal;
    event EpochFunded(uint256 indexed epoch, uint256 total, uint256 snapshotBlock);
    event Claimed(uint256 indexed epoch, address indexed account, uint256 amount);
    constructor(IERC20 dollar) { asset = dollar; treasury = msg.sender; }
    function epochCount() external view returns (uint256) { return epochs.length; }
    function getEpoch(uint256 id) external view returns (Epoch memory) { return epochs[id]; }
    function fund(address[] calldata accounts, uint256[] calldata amounts, string calldata memo) external nonReentrant returns (uint256 id, uint256 total) {
        require(msg.sender == treasury, "Treasury only");
        require(accounts.length != 0 && accounts.length <= 100 && accounts.length == amounts.length, "Invalid allocations");
        require(bytes(memo).length <= 240, "Memo too long");
        id = epochs.length;
        for (uint256 i; i < accounts.length; ++i) {
            require(accounts[i] != address(0), "Zero account");
            if (amounts[i] == 0) continue;
            require(allocation[id][accounts[i]] == 0, "Duplicate account");
            allocation[id][accounts[i]] = amounts[i];
            allocatedTotal[accounts[i]] += amounts[i];
            total += amounts[i];
        }
        require(total != 0, "Empty distribution");
        epochs.push(Epoch(total, 0, block.number, block.timestamp, memo));
        asset.safeTransferFrom(treasury, address(this), total);
        emit EpochFunded(id, total, block.number);
    }
    function claim(uint256 id) external nonReentrant {
        require(id < epochs.length, "Unknown distribution");
        uint256 amount = allocation[id][msg.sender];
        require(amount != 0, "No allocation for this wallet");
        require(!claimed[id][msg.sender], "Already claimed");
        claimed[id][msg.sender] = true;
        claimedTotal[msg.sender] += amount;
        epochs[id].claimed += amount;
        asset.safeTransfer(msg.sender, amount);
        emit Claimed(id, msg.sender, amount);
    }
}

/// @notice Testnet investment records are administrator attestations, not company shares.
/// Every purchase settles in valueless mUSD to the administrator's settlement wallet.
contract MainstreetTreasury is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    MainstreetTestDollar public immutable asset;
    MainstreetDistributions public immutable distributions;
    address public immutable settlementWallet;
    uint256 public immutable startedAtBlock;
    uint256 public totalFees;
    uint256 public reservedForOrders;
    uint256 public cashReserve;
    uint256 public outstandingCost;
    uint256 public totalIncome;
    uint256 public undistributedIncome;
    uint256 public totalDistributed;
    uint256 public totalUnits;
    address[] private members;
    mapping(address => bool) private memberAdded;
    mapping(address => uint256) public eligibleUnits;
    mapping(bytes32 => bool) public receiptUsed;
    enum Status { Reserved, Recorded, Cancelled, Repaid }
    struct Investment {
        string name;
        string security;
        string source;
        string documentURI;
        bytes32 documentHash;
        bytes32 receiptHash;
        uint256 cost;
        uint256 principalRepaid;
        uint256 incomeReceived;
        uint256 recordedAt;
        Status status;
    }
    Investment[] private investments;
    event FeeReceived(address indexed sender, uint256 amount);
    event InvestmentPrepared(uint256 indexed investment, uint256 cost, string name);
    event InvestmentRecorded(uint256 indexed investment, uint256 cost, bytes32 documentHash, bytes32 receiptHash);
    event InvestmentCancelled(uint256 indexed investment, uint256 cost);
    event InvestmentPayment(uint256 indexed investment, uint256 principal, uint256 income, bytes32 receiptHash);
    event UnitsUpdated(address indexed account, uint256 units);
    event CashReserveUpdated(uint256 amount);
    event DistributionFunded(uint256 indexed epoch, uint256 amount);
    constructor() Ownable(msg.sender) {
        require(block.chainid == 46630 || block.chainid == 11155111 || block.chainid == 31337, "Test networks only");
        asset = new MainstreetTestDollar();
        distributions = new MainstreetDistributions(IERC20(address(asset)));
        settlementWallet = msg.sender;
        startedAtBlock = block.number;
    }
    function version() external pure returns (string memory) { return "Mainstreet testnet 1"; }
    function investmentCount() external view returns (uint256) { return investments.length; }
    function getInvestment(uint256 id) external view returns (Investment memory) { return investments[id]; }
    function memberCount() external view returns (uint256) { return members.length; }
    function memberAt(uint256 id) external view returns (address) { return members[id]; }
    function cash() public view returns (uint256) { return asset.balanceOf(address(this)); }
    function availableCash() public view returns (uint256) { return cash() - reservedForOrders - cashReserve; }
    function depositFees(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount required");
        IERC20(address(asset)).safeTransferFrom(msg.sender, address(this), amount);
        totalFees += amount;
        emit FeeReceived(msg.sender, amount);
    }
    function prepareInvestment(string calldata name, string calldata security, string calldata source, uint256 cost) external onlyOwner {
        require(investments.length < 200, "Pilot is limited to 200 records");
        require(bytes(name).length > 0 && bytes(name).length <= 100, "Invalid business name");
        require(bytes(security).length > 0 && bytes(security).length <= 120, "Invalid security");
        require(bytes(source).length > 0 && bytes(source).length <= 500, "Invalid source");
        require(cost > 0 && cost <= availableCash(), "Insufficient available cash");
        uint256 id = investments.length;
        investments.push(Investment(name, security, source, "", bytes32(0), bytes32(0), cost, 0, 0, 0, Status.Reserved));
        reservedForOrders += cost;
        emit InvestmentPrepared(id, cost, name);
    }
    function cancelInvestment(uint256 id) external onlyOwner {
        Investment storage inv = investments[id];
        require(inv.status == Status.Reserved, "Not a reserved purchase");
        inv.status = Status.Cancelled;
        reservedForOrders -= inv.cost;
        emit InvestmentCancelled(id, inv.cost);
    }
    function recordInvestment(uint256 id, bytes32 documentHash, bytes32 receiptHash, string calldata documentURI) external onlyOwner nonReentrant {
        Investment storage inv = investments[id];
        require(inv.status == Status.Reserved, "Not a reserved purchase");
        require(documentHash != bytes32(0) && receiptHash != bytes32(0), "Evidence hashes required");
        require(!receiptUsed[receiptHash], "Receipt already used");
        require(bytes(documentURI).length <= 500, "Document URL too long");
        receiptUsed[receiptHash] = true;
        inv.status = Status.Recorded;
        inv.documentHash = documentHash;
        inv.receiptHash = receiptHash;
        inv.documentURI = documentURI;
        inv.recordedAt = block.timestamp;
        reservedForOrders -= inv.cost;
        outstandingCost += inv.cost;
        IERC20(address(asset)).safeTransfer(settlementWallet, inv.cost);
        emit InvestmentRecorded(id, inv.cost, documentHash, receiptHash);
    }
    function recordPayment(uint256 id, uint256 principal, uint256 income, bytes32 receiptHash) external onlyOwner nonReentrant {
        Investment storage inv = investments[id];
        require(inv.status == Status.Recorded || inv.status == Status.Repaid, "Investment not recorded");
        require(principal + income > 0, "Payment required");
        require(inv.principalRepaid + principal <= inv.cost, "Principal exceeds cost");
        require(receiptHash != bytes32(0) && !receiptUsed[receiptHash], "New receipt required");
        receiptUsed[receiptHash] = true;
        inv.principalRepaid += principal;
        inv.incomeReceived += income;
        outstandingCost -= principal;
        totalIncome += income;
        undistributedIncome += income;
        if (inv.principalRepaid == inv.cost) inv.status = Status.Repaid;
        IERC20(address(asset)).safeTransferFrom(msg.sender, address(this), principal + income);
        emit InvestmentPayment(id, principal, income, receiptHash);
    }
    function setCashReserve(uint256 amount) external onlyOwner {
        require(amount <= cash() - reservedForOrders, "Reserve exceeds cash");
        cashReserve = amount;
        emit CashReserveUpdated(amount);
    }
    function setUnits(address account, uint256 units) external onlyOwner {
        require(account != address(0) && units <= 1e18, "Invalid allocation");
        if (!memberAdded[account]) {
            require(members.length < 100, "Pilot is limited to 100 wallets");
            require(units > 0, "Units required for a new member");
            memberAdded[account] = true;
            members.push(account);
        }
        totalUnits = totalUnits - eligibleUnits[account] + units;
        eligibleUnits[account] = units;
        emit UnitsUpdated(account, units);
    }
    function fundDistribution(uint256 budget, string calldata memo) external onlyOwner nonReentrant returns (uint256 epoch) {
        require(totalUnits > 0, "No eligible wallets");
        require(budget > 0 && budget <= undistributedIncome && budget <= availableCash(), "Exceeds income or available cash");
        uint256[] memory amounts = new uint256[](members.length);
        uint256 actual;
        for (uint256 i; i < members.length; ++i) {
            amounts[i] = budget * eligibleUnits[members[i]] / totalUnits;
            actual += amounts[i];
        }
        require(actual > 0, "Distribution rounds to zero");
        undistributedIncome -= actual;
        totalDistributed += actual;
        IERC20(address(asset)).forceApprove(address(distributions), actual);
        (epoch,) = distributions.fund(members, amounts, memo);
        emit DistributionFunded(epoch, actual);
    }
}
