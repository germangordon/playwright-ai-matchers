export interface EvalResult {
    pass: boolean;
    reason: string;
}
export declare function evalMeansSomethingAbout(response: string, topic: string): Promise<EvalResult>;
export declare function evalSatisfies(response: string, criterion: string): Promise<EvalResult>;
export declare function evalHallucinates(response: string, context: string): Promise<EvalResult>;
export declare function evalIsHelpful(response: string): Promise<EvalResult>;
//# sourceMappingURL=claude.d.ts.map