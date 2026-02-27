export const newQuickJSWASMModuleFromVariant = () => ({
  newContext: () => ({
    newNumber: () => ({ dispose: () => {} }),
    newString: () => ({ dispose: () => {} }),
    newObject: () => ({ dispose: () => {} }),
    newArray: () => ({ dispose: () => {} }),
    setProp: () => {},
    getProp: () => ({ dispose: () => {} }),
    evalCode: () => ({ error: undefined, value: { dispose: () => {} } }),
    typeof: () => "undefined",
    dump: () => undefined,
    getString: () => "",
    getNumber: () => 0,
    undefined: { dispose: () => {} },
    global: { dispose: () => {} },
    dispose: () => {},
  }),
});

export default {};
