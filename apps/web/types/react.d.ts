// Minimal React type declarations to enable TypeScript compilation without @types/react.
// These intentionally trade completeness for compatibility with the components used in this project.
declare namespace React {
  type ReactNode = any;
  type Key = string | number | null;
  interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = any> {
    type: T;
    props: P;
    key: Key;
  }
  interface JSXElementConstructor<P> {
    (props: P): ReactElement<any> | null;
  }
  type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
  type SetStateAction<S> = S | ((prevState: S) => S);
  type Dispatch<A> = (value: A) => void;
  interface MutableRefObject<T> {
    current: T;
  }
  type RefCallback<T> = (instance: T | null) => void;
  type Ref<T> = MutableRefObject<T | null> | RefCallback<T> | null;
  interface FC<P = {}> {
    (props: PropsWithChildren<P>, context?: any): ReactElement<any> | null;
    displayName?: string;
  }
  type ComponentType<P = {}> = (props: PropsWithChildren<P>) => ReactElement<any> | null;
  type ComponentProps<T extends ComponentType<any> | keyof JSX.IntrinsicElements> = T extends ComponentType<infer P>
    ? PropsWithChildren<P>
    : T extends keyof JSX.IntrinsicElements
      ? JSX.IntrinsicElements[T]
      : never;
  interface Attributes {
    key?: Key;
  }
  interface RefAttributes<T> extends Attributes {
    ref?: Ref<T>;
  }
  interface IntrinsicAttributes extends Attributes {}
  interface IntrinsicClassAttributes<T> extends RefAttributes<T> {}
  interface HTMLAttributes<T> {
    key?: Key;
    id?: string;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
    onClick?: MouseEventHandler<T>;
    onChange?: ChangeEventHandler<T>;
    onSubmit?: FormEventHandler<T>;
    [key: string]: any;
  }
  interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
    href?: string;
    target?: string;
    rel?: string;
  }
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    src?: string;
    alt?: string;
    width?: number | string;
    height?: number | string;
    loading?: "lazy" | "eager";
  }
  interface DetailedHTMLProps<E extends HTMLAttributes<T>, T> extends E {}
  interface CSSProperties {
    [key: string]: string | number | undefined;
  }
  interface BaseSyntheticEvent<T = unknown, C = unknown, E = unknown> {
    target: T;
    currentTarget: C;
    preventDefault(): void;
    stopPropagation(): void;
    nativeEvent: E;
    [key: string]: any;
  }
  type SyntheticEvent<T = Element, E = Event> = BaseSyntheticEvent<T, T, E>;
  type FormEvent<T = Element> = SyntheticEvent<T>;
  type ChangeEvent<T = Element> = SyntheticEvent<T>;
  type MouseEvent<T = Element> = SyntheticEvent<T> & { button?: number; clientX?: number; clientY?: number };
  type TouchEvent<T = Element> = SyntheticEvent<T>;
  type KeyboardEvent<T = Element> = SyntheticEvent<T> & { key: string; code?: string; shiftKey?: boolean };
  type FocusEvent<T = Element> = SyntheticEvent<T>;
  type DragEvent<T = Element> = SyntheticEvent<T>;
  type FormEventHandler<T = Element> = (event: FormEvent<T>) => void;
  type ChangeEventHandler<T = Element> = (event: ChangeEvent<T>) => void;
  type MouseEventHandler<T = Element> = (event: MouseEvent<T>) => void;
  type TouchEventHandler<T = Element> = (event: TouchEvent<T>) => void;
  type KeyboardEventHandler<T = Element> = (event: KeyboardEvent<T>) => void;
  interface ForwardRefExoticComponent<P> {
    (props: P & RefAttributes<any>): ReactElement<any> | null;
    displayName?: string;
  }
  interface ProviderProps<T> extends PropsWithChildren<{ value: T }> {}
  interface ConsumerProps<T> extends PropsWithChildren<{ value?: T }> {}
  interface Context<T> {
    Provider: FC<ProviderProps<T>>;
    Consumer: FC<ConsumerProps<T>>;
  }
  function createContext<T>(defaultValue: T): Context<T>;
  function useContext<T>(context: Context<T>): T;
  function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  function useEffect(effect: () => void | (() => void), deps?: ReadonlyArray<unknown>): void;
  function useMemo<T>(factory: () => T, deps: ReadonlyArray<unknown>): T;
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: ReadonlyArray<unknown>): T;
  function useRef<T>(initialValue: T | null): MutableRefObject<T | null>;
  function useId(): string;
  function useTransition(): [boolean, (callback: () => void) => void];
  function useDeferredValue<T>(value: T): T;
  function startTransition(callback: () => void): void;
  function forwardRef<T, P = {}>(render: (props: P, ref: Ref<T>) => ReactElement<any> | null): ForwardRefExoticComponent<P>;
  const Fragment: unique symbol;
}

declare module "react" {
  export = React;
  export as namespace React;
}

declare module "react-dom" {
  const ReactDOM: {
    createPortal(children: React.ReactNode, container: Element | DocumentFragment): React.ReactNode;
  };
  export = ReactDOM;
}

declare module "react-dom/client" {
  interface Root {
    render(children: React.ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | Document | DocumentFragment | Comment, options?: unknown): Root;
}

declare module "react/jsx-runtime" {
  export const Fragment: typeof React.Fragment;
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export function jsxDEV(type: any, props: any, key?: any, isStaticChildren?: boolean, source?: any, self?: any): any;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
  interface IntrinsicAttributes extends React.IntrinsicAttributes {}
  interface IntrinsicClassAttributes<T> extends React.IntrinsicClassAttributes<T> {}
  type LibraryManagedAttributes<C, P> = P;
  interface ElementChildrenAttribute {
    children: {};
  }
  type Element = React.ReactElement<any>;
}
