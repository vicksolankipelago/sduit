declare module 'json-logic-js' {
  const jsonLogic: {
    apply: (logic: unknown, data?: unknown) => unknown;
    add_operation: (name: string, func: (...args: unknown[]) => unknown) => void;
    rm_operation: (name: string) => void;
  };
  export default jsonLogic;
}
