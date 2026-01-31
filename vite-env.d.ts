/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_MELHOR_ENVIO_TOKEN: string
    readonly VITE_MELHOR_ENVIO_USER_AGENT: string
    readonly VITE_OPEN_ROUTER_API_KEY: string
    readonly VITE_OPEN_ROUTER_MODEL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
