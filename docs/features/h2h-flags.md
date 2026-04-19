# Head to Head — Match Flags Quick Guide

The **Head to Head** page lets you compare two community players' full match history. When a match is recorded incorrectly—or carries context that changes how it should count—either player can **flag it** for admin review.

---

## For Players — How to Flag a Match

### Why flag a match?

Not every recorded game belongs in a competitive H2H record. Common reasons to flag:

| Flag type | What it means | Effect after approval |
|-----------|---------------|----------------------|
| **Void** | The match shouldn't count (e.g., practice game, technical drop, wrong matchup) | Match is excluded from win/loss totals and marked as voided |
| **Showmatch** | The game was a public exhibition, not a ranked/competitive match | Match is labeled "Showmatch" in the history list |
| **Tournament** | The game was played in an official tournament context | Match is labeled "Tournament" in the history list |

Voided matches are the most impactful: they are fully removed from the head-to-head score (`totalGames`, `player1Wins`, `player2Wins`). Label flags (Showmatch / Tournament) keep the match in the count but add a visible badge for context.

### How to submit a flag

1. Go to **Head to Head** in the top navigation.
2. Search for and select both players to load their match history.
3. Find the match you want to flag and click the **flag icon** (🚩) on that row.
4. In the modal:
   - **Select the flag type** — Void, Showmatch, or Tournament.
   - **For Void only**: enter a short reason explaining why the match shouldn't count (required).
   - **Your BTag**: type or search your BattleTag. You must be a registered community member — the field will autocomplete from the community roster.
5. Click **Submit Flag**.

You'll see a green confirmation: _"Flag submitted — pending admin review."_

### What happens next?

Your flag lands in the admin queue with **pending** status. An admin will review it and either approve or reject it. There is no notification yet — check back if you want to confirm the outcome.

**Constraints:**
- You must be a known community member (your BTag must be in the community roster).
- Only one pending flag per match is allowed. If a flag for that match is already pending, the submission will be rejected with an error.
- You can flag any match visible in the H2H view, regardless of which player you are.

---

## For Admins — The Flag Approval Workflow

### Where to find flags

Navigate to **Admin → Flag Review** (`/admin/h2h-flags`). The page requires an admin session (JWT-authenticated).

Flags are organized into four tabs:

| Tab | Shows |
|-----|-------|
| **Pending** | Flags awaiting a decision (default view) |
| **Approved** | Flags that were approved |
| **Rejected** | Flags that were rejected |
| **All** | Combined list across all statuses |

### Reading a flag card

Each card displays:

- **Status badge** — yellow (pending), green (approved), red (rejected)
- **Flag type badge** — Void, Showmatch, or Tournament
- **Flag ID** — internal reference number
- **Players** — both character IDs resolved to display names where available
- **Date** — when the match was played
- **Map** — map the match was played on
- **Reason** — player's explanation (Void flags only)
- **Submitted by** — the BTag of the flagging player
- **Admin note** — visible only after rejection, if one was written

### Approving a flag

Click **Approve** on any pending flag.

What happens in the backend depends on the flag type:

- **Void**: sets `is_voided = true` on the match row and resets `pulse_synced_at` to epoch, forcing the next H2H query to re-sync match data from Pulse. The match is immediately excluded from win/loss counts on the H2H page.
- **Showmatch / Tournament**: sets `match_label` on the match row to the corresponding value. The match remains in the score totals but displays the label badge in the H2H match list.

The flag status is set to `approved` with a timestamp.

> Only **pending** flags can be approved. Attempting to approve an already-reviewed flag returns a `FLAG_NOT_PENDING` error.

### Rejecting a flag

Click **Reject** on a pending flag. A text area expands to let you write an optional admin note (up to 500 characters) explaining the decision. Click **Confirm Reject** to finalize, or **Cancel** to go back.

The flag status is set to `rejected`. No change is made to the match data.

### Approval workflow summary

```
Player submits flag
       │
       ▼
  status: pending
       │
  Admin reviews
       │
  ┌────┴────┐
  │         │
Approve   Reject
  │         │
  ▼         ▼
Match    status: rejected
updated  (optional admin note)
status: approved
```

### API reference (admin endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/h2h/flags` | List flags; optional `?status=pending\|approved\|rejected` |
| `PATCH` | `/api/h2h/flags/:flagId` | Approve or reject a flag |

`PATCH` body:
```json
{ "action": "approve" }
{ "action": "reject", "adminNote": "optional explanation" }
```

All admin flag endpoints require a valid `Authorization: Bearer <token>` header.
