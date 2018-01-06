goog.module('soccersub.Assignment2');

/**
 * Captures an assignment that we want to make. Players are specified as
 * indexes into this.players_.  The critical design question here is what
 * happens to automated and manually specified assignments when:
 *   - a player is swapped or renamed.  In this case, all assignments are
 *     retained except for the even swap.
 *   - players are removed or added.  In this case, the default assignments
 *     are recomputed from scratch based on the player ordering.  We try to
 *     keep the ordering as stable as possible.
 *
 * @typedef {!{
 *   playerName: string,
 *   positionName: string,
 *   timeSec: number,
 *   executed: boolean,
 * }}
 */
let Assignment2;

exports = Assignment2;
