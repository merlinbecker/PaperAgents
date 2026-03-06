/**
 * QuickJS Mock for Vitest
 *
 * Provides a mock implementation that uses Node.js Function constructor
 * to actually evaluate JavaScript code, simulating QuickJS behavior.
 * Mocks both "quickjs-emscripten-core" and "@jitl/quickjs-singlefile-cjs-release-sync".
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------- Handle ----------
class MockHandle {
  constructor(public value: any) {}
  dispose(): void { /* no-op */ }
}

// ---------- Context ----------
class MockContext {
  private globals: Record<string, any> = {};

  global = new MockHandle(this.globals);
  undefined = new MockHandle(undefined);

  /**
   * Evaluate JavaScript code with access to previously-set global variables.
   * Uses `new Function(...)` under the hood so that `return` works naturally.
   */
  evalCode(code: string, _filename?: string): { value?: MockHandle; error?: MockHandle } {
    try {
      const scopeKeys = Object.keys(this.globals);
      const scopeValues = scopeKeys.map((k) => this.globals[k]);

      // Uses `new Function(...)` under the hood so that `return` works naturally.
      // This is intentional: this mock simulates QuickJS sandbox evaluation for tests.
      // Production code uses the actual QuickJS WebAssembly sandbox which is isolated.
      const fn = new Function(...scopeKeys, `return (${code});`); // NOSONAR
      const result = fn(...scopeValues);
      return { value: new MockHandle(result), error: undefined };
    } catch (e: any) {
      return {
        error: new MockHandle({
          message: e instanceof Error ? e.message : String(e),
        }),
        value: undefined,
      };
    }
  }

  unwrapResult(result: { value?: MockHandle; error?: MockHandle }): MockHandle {
    if (result.error) {
      const v = result.error.value;
      throw new Error(typeof v === "string" ? v : v?.message ?? "Unknown error");
    }
    return result.value!;
  }

  dump(handle: MockHandle): any {
    return handle.value;
  }

  setProp(target: MockHandle, name: string, value: MockHandle): void {
    if (target === this.global || target.value === this.globals) {
      this.globals[name] = value.value;
    } else if (target.value && typeof target.value === "object") {
      target.value[name] = value.value;
    }
  }

  getProp(target: MockHandle, name: string): MockHandle {
    if (target === this.global || target.value === this.globals) {
      return new MockHandle(this.globals[name]);
    }
    return new MockHandle(target.value?.[name]);
  }

  newNumber(v: number): MockHandle { return new MockHandle(v); }
  newString(v: string): MockHandle { return new MockHandle(v); }
  newObject(): MockHandle { return new MockHandle({}); }
  newArray(): MockHandle { return new MockHandle([]); }
  typeof(h: MockHandle): string { return typeof h.value; }
  getString(h: MockHandle): string { return String(h.value); }
  getNumber(h: MockHandle): number { return Number(h.value); }

  dispose(): void { /* no-op */ }
}

// ---------- Runtime ----------
class MockRuntime {
  setMemoryLimit(_bytes: number): void { /* no-op */ }
  setInterruptHandler(_handler: () => boolean): void { /* no-op */ }

  newContext(): MockContext {
    return new MockContext();
  }

  dispose(): void { /* no-op */ }
}

// ---------- Module ----------
class MockModule {
  newRuntime(): MockRuntime {
    return new MockRuntime();
  }

  newContext(): MockContext {
    return new MockContext();
  }
}

// ---------- Exports (quickjs-emscripten-core) ----------

/** Simulates the async factory from quickjs-emscripten-core */
export const newQuickJSWASMModuleFromVariant = async (_variant?: any): Promise<MockModule> => {
  return new MockModule();
};

// Re-export class types so `import { QuickJSContext, QuickJSRuntime }` resolves
export type QuickJSContext = MockContext;
export type QuickJSRuntime = MockRuntime;

// ---------- Default export (@jitl/quickjs-singlefile-cjs-release-sync variant) ----------
export default {};
