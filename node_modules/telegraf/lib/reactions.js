"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageReactions = exports.ReactionList = exports.Digit = void 0;
const util_1 = require("./core/helpers/util");
exports.Digit = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
const inspectReaction = (reaction) => {
    if (reaction.type === 'custom_emoji')
        return `Custom(${reaction.custom_emoji_id})`;
    else
        return reaction.emoji;
};
class ReactionList {
    constructor(list) {
        this.list = list;
    }
    static fromArray(list = []) {
        return (0, util_1.indexed)(new ReactionList(list), function (index) {
            return this.list[index];
        });
    }
    static has(reactions, reaction) {
        if (typeof reaction === 'string')
            if (exports.Digit.has(reaction[0]))
                return reactions.some((r) => r.custom_emoji_id === reaction);
            else
                return reactions.some((r) => r.emoji === reaction);
        return reactions.some((r) => {
            if (r.type === 'custom_emoji')
                return r.custom_emoji_id === reaction.custom_emoji_id;
            else if (r.type === 'emoji')
                return r.emoji === reaction.emoji;
        });
    }
    toArray() {
        return [...this.list];
    }
    filter(filterFn) {
        return ReactionList.fromArray(this.list.filter(filterFn));
    }
    has(reaction) {
        return ReactionList.has(this.list, reaction);
    }
    get count() {
        return this.list.length;
    }
    [Symbol.iterator]() {
        return this.list[Symbol.iterator]();
    }
    [Symbol.for('nodejs.util.inspect.custom')]() {
        const flattened = this.list.map(inspectReaction).join(', ');
        return ['ReactionList {', flattened, '}'].join(' ');
    }
}
exports.ReactionList = ReactionList;
class MessageReactions extends ReactionList {
    constructor(ctx) {
        var _a, _b;
        super((_b = (_a = ctx.update.message_reaction) === null || _a === void 0 ? void 0 : _a.new_reaction) !== null && _b !== void 0 ? _b : []);
        this.ctx = ctx;
    }
    static from(ctx) {
        return (0, util_1.indexed)(new MessageReactions(ctx), function (index) {
            return this.list[index];
        });
    }
    get old() {
        var _a;
        return ReactionList.fromArray((_a = this.ctx.update.message_reaction) === null || _a === void 0 ? void 0 : _a.old_reaction);
    }
    get new() {
        var _a;
        return ReactionList.fromArray((_a = this.ctx.update.message_reaction) === null || _a === void 0 ? void 0 : _a.new_reaction);
    }
    get added() {
        return this.new.filter((reaction) => !this.old.has(reaction));
    }
    get removed() {
        return this.old.filter((reaction) => !this.new.has(reaction));
    }
    get kept() {
        return this.new.filter((reaction) => this.old.has(reaction));
    }
}
exports.MessageReactions = MessageReactions;
