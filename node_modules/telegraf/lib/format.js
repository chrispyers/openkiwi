"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mention = exports.link = exports.pre = exports.code = exports.quote = exports.underline = exports.strikethrough = exports.spoiler = exports.italic = exports.bold = exports.fmt = exports.join = exports.FmtString = void 0;
const formatting_1 = require("./core/helpers/formatting");
Object.defineProperty(exports, "FmtString", { enumerable: true, get: function () { return formatting_1.FmtString; } });
// Nests<A, B> means the function will return A, and it can nest B
// Nests<'fmt', string> means it will nest anything
// Nests<'code', never> means it will not nest anything
// Allowing everything to nest 'fmt' is a necessary evil; it allows to indirectly nest illegal entities
// Except for 'code' and 'pre', which don't nest anything anyway, so they only deal with strings
exports.join = formatting_1.join;
exports.fmt = (0, formatting_1.createFmt)();
exports.bold = (0, formatting_1.createFmt)('bold');
exports.italic = (0, formatting_1.createFmt)('italic');
exports.spoiler = (0, formatting_1.createFmt)('spoiler');
exports.strikethrough = 
//
(0, formatting_1.createFmt)('strikethrough');
exports.underline = 
//
(0, formatting_1.createFmt)('underline');
exports.quote = 
//
(0, formatting_1.createFmt)('blockquote');
exports.code = (0, formatting_1.createFmt)('code');
const pre = (language) => (0, formatting_1.createFmt)('pre', { language });
exports.pre = pre;
const link = (content, url) => 
//
(0, formatting_1.linkOrMention)(content, { type: 'text_link', url });
exports.link = link;
const mention = (name, user) => typeof user === 'number'
    ? (0, exports.link)(name, 'tg://user?id=' + user)
    : (0, formatting_1.linkOrMention)(name, {
        type: 'text_mention',
        user,
    });
exports.mention = mention;
