import { Component, Suspense, lazy } from "react";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Chrome remembers a failed import() and fails the same URL again without going to the network,
// so a retry must ask for the chunk under a new URL. Chrome's error message carries the URL; in
// browsers whose message doesn't, the retry falls back to the normal import.
const freshUrl = (error) => {
  const url = String(error?.message).match(/https?:\/\/\S+?\.js/)?.[0];
  return url && `${url}?retry=${Date.now()}`;
};

// A page whose code downloads only when it's opened, keeping heavy libraries such as
// @react-pdf/renderer out of the bundle every phone loads at startup (PERFORMANCE_AUDIT N3).
// On a weak signal the download can fail: it's retried twice (1 s, 3 s), then the page shows a
// "Reintentar" button instead of a blank screen.
export function lazyPage(load) {
  let Page;
  const make = () => {
    Page = lazy(async () => {
      let lastError;
      for (const wait of [0, 1000, 3000]) {
        await sleep(wait);
        try {
          const url = lastError && freshUrl(lastError);
          return await (url ? import(/* @vite-ignore */ url) : load());
        } catch (error) {
          lastError = error;
        }
      }
      make(); // React keeps a failed lazy() failed forever: "Reintentar" needs a fresh one
      throw lastError;
    });
  };
  make();
  return function LazyPage(props) {
    return (
      // A function, so "Reintentar" renders the fresh Page, not the element that failed
      <LoadBoundary>
        {() => (
          <Suspense fallback={<p className="text-center py-10">Cargando...</p>}>
            <Page {...props} />
          </Suspense>
        )}
      </LoadBoundary>
    );
  };
}

class LoadBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children();
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg p-6 text-center">
        <p className="font-bold mb-2">No se pudo abrir esta página</p>
        <p className="mb-4">
          La señal está débil o se perdió. Toque Reintentar cuando tenga mejor señal. Si sigue
          fallando, cierre y vuelva a abrir la aplicación.
        </p>
        <button
          type="button"
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded"
          onClick={() => this.setState({ failed: false })}
        >
          Reintentar
        </button>
      </div>
    );
  }
}
