# x402.NanoSession Architecture Diagrams

These diagrams illustrate the core workflows and logic of the x402.NanoSession (Rev 1) protocol.

## 1. Protocol Sequence Flow

This diagram shows the complete lifecycle of a resource request, from the initial 402 challenge to the asynchronous verification and final lazy settlement.

![Protocol Sequence Flow](img/sequence_flow.svg)

**D2 Version (Offline/Native):**
![Protocol Sequence Flow D2](img/sequence_flow_d2.svg)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client (Purse)
    participant S as Server (Middleware)
    participant N as Nano Network
    participant B as Background Janitor

    Note over C,S: 1. Initial Handshake
    C->>S: GET /api/resource
    S->>S: Derive Pool Address & Tag
    S-->>C: 402 Payment Required
    Note right of S: Returns JSON/Headers:<br/>- X-402-Address (Sharded)<br/>- X-402-Tag (e.g., 4291)<br/>- Price_Raw

    Note over C,N: 2. Payment Phase
    C->>C: Check Budget
    C->>C: Amount = Price + Tag
    C->>N: Broadcast Send Block
    Note right of C: Stores Block_Hash as Receipt

    Note over C,S: 3. Verification Phase (Async)
    C->>S: GET /api/resource<br/>Header: X-402-Payment-Block: <Hash>
    S->>N: Verify Block Confirmation (RPC/WebSocket)
    N-->>S: Block Details (Confirmed)
    
    rect rgb(240, 248, 255)
    Note right of S: Validation Logic
    S->>S: Check Destination == Pool Address
    S->>S: Check Amount >= Price
    S->>S: Check Amount % Modulus == Tag
    S->>S: Idempotency Check (Mark Hash Used)
    end

    S-->>C: 200 OK (Resource)

    Note over B,N: 4. Lazy Settlement (Async/Cron)
    B->>N: Sweep funds from Sharded Pool -> Cold Wallet
```

## 2. Sharding & Tagging Logic

This flowchart visualizes how the Server deterministically maps a Session and Request to a specific Nano Address and Amount.

![Sharding & Tagging Logic](img/sharding_logic.svg)

**D2 Version (Offline/Native):**
![Sharding & Tagging Logic D2](img/sharding_logic_d2.svg)

```mermaid
flowchart TD
    subgraph Inputs
    SID[Session ID]
    RID[Request ID]
    P[Price_Raw]
    end

    subgraph "Sharding Logic"
    Seed[Server Master Seed]
    PoolSize[CONSTANT: POOL_SIZE]
    
    H1["Hash(Session ID)"]
    Idx["Pool Index = H1 % PoolSize"]
    
    Seed --> Derive
    Idx --> Derive
    Derive[Derive Address] --> Addr[Target Address]
    end

    subgraph "Tagging Logic"
    TagMod[CONSTANT: TAG_MODULUS]
    
    H2["Hash(Request ID + Nonce)"]
    Tag["Tag = H2 % TagMod"]
    
    Calc[Final Amount = Price + Tag]
    end
    
    SID --> H1
    RID --> H2
    P --> Calc
    Tag --> Calc

    subgraph Outputs
    Addr
    Amt[Final Amount]
    end
    
    style Addr fill:#d4f1f4,stroke:#333
    style Amt fill:#d4f1f4,stroke:#333
```

## 3. Client (Purse) State Machine

This diagram details the decision-making process within the Client Agent (Purse).

![Client State Machine](img/purse_state.svg)

**D2 Version (Offline/Native):**
![Client State Machine D2](img/purse_state_d2.svg)

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    state "Transaction Flow" as Tx {
        Idle --> Requesting: User/Agent needs Resource
        Requesting --> PaymentRequired: Server returns 402
        
        state PaymentRequired {
            [*] --> CheckBudget
            CheckBudget --> Abort: Exceeds Daily Limit
            CheckBudget --> CalcAmount: Within Limit
            CalcAmount --> SignBlock: Amount = Price + Tag
            SignBlock --> Broadcast: Publish to Network
            Broadcast --> SaveReceipt: Store BlockHash
        }
        
        Abort --> Failed: Budget Error
        SaveReceipt --> Verifying: Retry Request + Hash
    }

    Verifying --> Success: 200 OK
    Verifying --> Failed: 402 (Invalid) / 409 (Replay)
    
    Success --> Idle: Task Complete
    Failed --> [*]: Handle Error
```
