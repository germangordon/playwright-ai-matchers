"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const claude_1 = require("./claude");
test_1.expect.extend({
    async toMeanSomethingAbout(received, topic) {
        const { isNot } = this;
        const result = await (0, claude_1.evalMeansSomethingAbout)(received, topic);
        return {
            pass: result.pass,
            message: () => isNot
                ? [
                    `Expected response NOT to be about "${topic}", but it was.`,
                    `Reason:   ${result.reason}`,
                    `Received: ${received}`,
                ].join('\n')
                : [
                    `Expected response to mean something about "${topic}", but it didn't.`,
                    `Reason:   ${result.reason}`,
                    `Received: ${received}`,
                ].join('\n'),
        };
    },
    async toSatisfy(received, criterion) {
        const { isNot } = this;
        const result = await (0, claude_1.evalSatisfies)(received, criterion);
        return {
            pass: result.pass,
            message: () => isNot
                ? [
                    `Expected response NOT to satisfy: "${criterion}", but it did.`,
                    `Reason:   ${result.reason}`,
                    `Received: ${received}`,
                ].join('\n')
                : [
                    `Expected response to satisfy: "${criterion}", but it didn't.`,
                    `Reason:   ${result.reason}`,
                    `Received: ${received}`,
                ].join('\n'),
        };
    },
    async toHallucinate(received, context) {
        const { isNot } = this;
        const result = await (0, claude_1.evalHallucinates)(received, context);
        return {
            pass: result.pass,
            message: () => isNot
                ? [
                    `Expected response NOT to hallucinate facts outside the provided context, but it did.`,
                    `Reason:   ${result.reason}`,
                    `Received: ${received}`,
                ].join('\n')
                : [
                    `Expected response to hallucinate facts not in context, but none were detected.`,
                    `Reason:   ${result.reason}`,
                    `Received: ${received}`,
                ].join('\n'),
        };
    },
    async toBeHelpful(received) {
        const { isNot } = this;
        const result = await (0, claude_1.evalIsHelpful)(received);
        return {
            pass: result.pass,
            message: () => isNot
                ? [
                    `Expected response NOT to be helpful, but it was.`,
                    `Reason:   ${result.reason}`,
                    `Received: ${received}`,
                ].join('\n')
                : [
                    `Expected response to be helpful, but it wasn't.`,
                    `Reason:   ${result.reason}`,
                    `Received: ${received}`,
                ].join('\n'),
        };
    },
});
//# sourceMappingURL=matchers.js.map