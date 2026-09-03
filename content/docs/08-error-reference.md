# Relay — Error Reference

**Version:** 1.0
**Companion to:** `04-srs.md` EIR-API-04, EIR-WS-06
**Purpose:** Every error code the platform can emit, what caused it, and what a client
should do about it. This is the page `docs_url` points at: an error response carries
`docs_url` in its envelope, and the fragment is the code verbatim, so
`https://relay.dev/docs/error-reference#quota_exceeded` lands on that code's section.

The set is closed and checked. `ERROR_CODES` in `@relay/protocol` is the registry, and a
check in the tutorial repository compares it against the `h2` headings below **in both
directions** — a code with no section fails the build, and a section for a code that
cannot be emitted fails it too. A reference documenting a retired code is how a
documentation set starts lying.

**Retryable or not, always stated.** A client that retries a refusal it can never satisfy
waits for ever, and a client that gives up on a transient one loses a message. Every
section below says which it is.

Errors arrive in one shape on both surfaces (EIR-API-04, and the same payload inside a
WebSocket `error` frame):

```json
{
  "code": "invalid_request",
  "message": "metadata must be at most 8192 bytes of JSON",
  "docs_url": "https://relay.dev/docs/error-reference#invalid_request",
  "request_id": "9c2f8a1e-4b7d-4f3a-9e51-6d8c2b0a7f14",
  "field": "metadata"
}
```

`field` is present only when one key is at fault. `request_id` is on every response,
header and body alike, and it is the thing to quote in a support request.

---

## invalid_request

**Status:** 400 · **Retryable:** no, not without changing the request

The body, query string or path failed validation. `field` names the first offending key —
`metadata` for a payload over 8 KB, `type` for a channel type the platform does not
accept, `user_ids` for a member list over 100.

Unknown fields are rejected rather than ignored, which is deliberate: a client that sends
`externalId` where the API expects `external_id` finds out on the first call instead of
wondering why the name never appears.

**What to do:** read `field`, fix that key, send again. Retrying the same body will fail
identically.

## unauthorized

**Status:** 401 · **Retryable:** no, not with the same credential

No credential was presented, or the one presented is not valid for this route: an expired
end-user token, a malformed one, one signed by another environment's secret, or no
`Authorization` header at all.

The message says what the route wanted. It never repeats the credential — a key in a
support ticket is a leaked key (NFR-SEC-06).

**What to do:** for an end-user token, mint a fresh one. For an application key, check it
is the key for the environment you mean.

## wrong_credential_type

**Status:** 403 · **Retryable:** no

The credential is perfectly valid and is the wrong KIND for this route. An application key
where an end-user token is required, or the reverse.

This has its own code rather than a generic `forbidden` because the two are different
facts and only one of them is fixable by the caller in a minute: "you lack a permission"
sends a developer to look for a permissions screen, and "you presented the wrong kind of
credential" sends them to the line of code that chose the header. The SRS singles this out
as the most common first-integration failure.

**What to do:** the message names the class the route expects and the class you presented.
Present the other one.

## wrong_credential_service

**Status:** 403 · **Retryable:** no

A platform credential was presented on a route belonging to a different internal service.
The class is right and the service is not.

Internal routes only. A customer integrating against Relay cannot produce this error, and
it is documented because it appears in platform logs and because `docs_url` is derived
from the code — an undocumented code would ship a link to nothing.

**What to do:** internal callers should present the credential for the service that owns
the route. The message names the service presented and the services permitted.

## sender_not_permitted

**Status:** 403 · **Retryable:** no

An application credential named a person in `user` when sending a message. A key may speak
as software and not as any person: it acts for the tenant, not for one of the tenant's
users, so the only sender it may name is a bot user of that same tenant.

The third refusal in a family. `wrong_credential_type` is the wrong credential *class*,
`wrong_credential_service` the wrong *service*, and this one is the right class naming the
wrong *kind of user*.

The message names neither the person asked for nor the bots that would have been accepted.
Which identifiers exist in a tenant is not something a refusal reveals — a message listing
the acceptable senders would be an enumeration endpoint behind a 403.

**What to do:** create a bot user — a `users` upsert entry with `kind: "bot"` and a
`description` saying what the software is — and name it in `user`. A user token needs none
of this: its send is attributed to the token's subject, and naming `user` in the body is
refused.

## forbidden

**Status:** 403 · **Retryable:** no

The credential is valid and is not permitted to perform this operation. The generic case:
where a more specific code exists — `wrong_credential_type`, `wrong_credential_service` —
that one is sent instead.

**What to do:** nothing the client can retry. This is a change of credential or of
permission.

## not_found

**Status:** 404 · **Retryable:** no

No such resource. **And deliberately the same answer for a resource that belongs to
another tenant** — same status, same body, byte for byte, with only `request_id`
differing.

That identity is a security property and not an implementation detail (FR-TEN-05,
NFR-SEC-09). If a foreign channel answered differently from an absent one, the difference
would be a way to enumerate other customers' resources: send ids, watch which answer comes
back, keep the ones that answer "not yours". So the platform declines to tell you whether
the thing exists, and a cross-tenant suite attacks every endpoint on every build to keep
that true.

**What to do:** check the id, and check it belongs to the environment your credential
belongs to.

## channel_member_limit_exceeded

**Status:** 422 · **Retryable:** no — waiting changes nothing

The channel already holds its maximum members (1,000), and the request would have taken it
past that. The message names the current count, the limit, and how many the request tried
to add. Nobody was added: the check runs before any user is created, so a refused call
leaves no rows behind.

**Not the same as `quota_exceeded`,** and the difference matters for what a client does
next. A quota is monthly and resets on a date; this is a structural limit on one channel
that no amount of waiting changes.

**What to do:** use more channels, or remove members. Retrying is futile.

## not_a_member

**Status:** 403 · **Retryable:** no, until the user is a member

The user is not a member of this channel, and the operation is one that only a member can
perform. In practice there is **one** operation like that: recording a read position, which
is per-member state keyed by channel and user.

**Where you will NOT see this,** because both are more interesting than they look. A
**private** channel the caller cannot see answers `404 not_found` — byte-identical to a
channel that does not exist, body and status, because a `403` naming the membership would
tell you the channel exists. And a **public** channel permits any authenticated user of the
tenant to read, send and join without being a member at all, so nothing there refuses.

**What to do:** add the user to the channel, or have them join it if it is public. The
message never names the channel's contents or its other members.

## channel_archived

**Status:** 403 · **Retryable:** yes, once the channel is unarchived

The channel is archived. Archiving stops new messages and keeps everything already written:
history reads normally, the channel still appears in listings, and unarchiving restores
sending with nothing lost.

**Not the same as `not_found`,** and you will only ever see this for a channel you can
already see. The refusal order is ban, then membership and visibility, then archive —
reversed, a non-member of a private archived channel would learn it exists from this code.

**What to do:** unarchive the channel, or write somewhere else. Retrying the same send
against the same archived channel will keep failing.

## user_banned

**Status:** 403 · **Retryable:** no, until the ban is lifted

The user is banned in this environment. A ban is tenant-scope rather than per channel: they
cannot open a socket and cannot send anywhere. Their existing messages stay exactly where
they are, readable by everyone else and still attributed to them.

**You will see this for every channel id, including ones that do not exist,** and that is
deliberate: the ban is checked before the channel is resolved, so this refusal cannot be
used to find out which channels exist.

**What to do:** lift the ban if it was a mistake. There is nothing a client can retry into.

## rate_limited

**Status:** 429 · **Retryable:** YES, after the window

Too many requests, frames or connection attempts in the current window. `Retry-After` is
set on the HTTP response.

On a socket, this arrives as an `error` frame and **the connection stays open**. Closing it
would make the client reconnect, and a reconnect spends the connection-establishment
allowance — a limiter that punishes the limited into hitting a second limit. The frame
refuses that one frame and nothing more.

**What to do:** back off and retry. Honour `Retry-After` where it is present; on a socket,
wait for the window to turn over and send again on the connection you still have.

## quota_exceeded

**Status:** 402 · **Retryable:** yes, from the date in the message

A monthly quota is exhausted. The message names the dimension (messages, active users or
connection-minutes), the figure used, the figure allowed, and the date it resumes.

Three notification emails precede this at 80%, 90% and 100% of each quota, so it should
never be the first anyone hears of it.

**What to do:** wait for the period to roll over, or raise the quota. Retrying before the
date in the message will fail identically; the date is what makes it retryable at all.

## connection_environment_conflict

**Status:** 409 · **Retryable:** no

A connection was reported for one environment and is now being reported for another. A
connection belongs to one environment for its whole life, so this is a bug in the reporter
rather than a state to reconcile — absorbing it would mean billing two tenants for one
socket.

Internal routes only; a customer integration cannot produce it.

**What to do:** internal callers should report a connection under the environment it was
established for.

## invalid_frame

**Status:** WebSocket `error` frame · **Retryable:** no, not unchanged

A frame sent over the socket was not JSON, or was JSON that failed schema validation. The
message carries the first schema complaint.

**What to do:** fix the frame. The connection stays open, so the next well-formed frame
goes through.

## unknown_frame_type

**Status:** WebSocket `error` frame, then close 4002 · **Retryable:** no

The frame's `type` names something a CLIENT may not send. **Two frames are inbound —
`message.send` and `typing.send`** — and every other member of the frame union is
server-to-client, so a client uttering one is a protocol violation rather than a malformed
frame.

**The inbound set is named rather than listed by exception, and the spelling is the rule:
an inbound frame ends in `.send`.** A frame whose type is outside that set is refused here
however well-formed it is.

This one closes the connection (4002) where `invalid_frame` does not, and the distinction
is deliberate: a bad frame is a bug in one message, and a client claiming to be the server
is a bug in the client's model of the protocol. The two are also reached in that order — a
type the union does not contain at all fails schema validation first and gets
`invalid_frame` with the socket left open.

**What to do:** send `message.send` to post a message, or `typing.send` to say you are
typing in a channel. Do not send events; receive them.

## connection_limit_reached

**Status:** WebSocket `error` frame, then close 4004 · **Retryable:** no, not unchanged

A user may hold five concurrent connections in an environment (FR-RTM-09) and this one would
have been the sixth. **The count is per user per environment and is shared by every gateway
instance**, so opening the sixth against a different host does not help. The five already
open are untouched — nothing is closed to make room, and they keep receiving while the
refusal happens.

**The count is a live one.** A connection that ends frees its place immediately, with no
waiting period. A connection whose gateway died frees its place when the 60-second lease on
it expires, which is the one case where waiting is the answer.

**This is the only refusal in the WebSocket set whose correct handling is not a retry.**
Reconnecting at once produces the same refusal; backing off produces it more slowly. Every
other close code this platform sends — an expired token, a quota, a drain — is answered by
trying again in some form. This one is answered by giving something up.

**What to do:** close one of the connections you already hold, then connect — immediately,
with no delay. If you believe you hold fewer than five, count sockets rather than tabs: a
page that opens a connection per component holds several, and a reconnect loop that does not
close the old socket first holds two for as long as the old one takes to notice.

## internal_error

**Status:** 500 · **Retryable:** yes, with backoff

The platform failed in a way it did not anticipate. No detail is returned, because a stack
trace on the wire is an information leak and a message that guesses is worse than one that
does not.

**What to do:** retry with backoff — many 500s are transient. If it persists, quote the
`request_id` from the response: it is in the log line for that request, and it is the
fastest way to the cause.

