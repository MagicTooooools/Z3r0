package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

const (
	defaultProxyAddr   = ":8000"
	defaultNoVNCTarget = "http://127.0.0.1:8080"
	noVNCPathPrefix    = "/novnc"
	websockifyPath     = "/websockify"
)

func newPassthroughProxy(target *url.URL) http.Handler {
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.Host = target.Host
	}
	return proxy
}

func newPrefixProxy(prefix string, target *url.URL) http.Handler {
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(request *http.Request) {
		originalDirector(request)
		request.URL.Path = trimPrefixPath(request.URL.Path, prefix)
		request.URL.RawPath = ""
		request.Host = target.Host
	}
	return proxy
}

func trimPrefixPath(path string, prefix string) string {
	if path == prefix {
		return "/"
	}
	if strings.HasPrefix(path, prefix+"/") {
		trimmed := strings.TrimPrefix(path, prefix)
		if trimmed == "" {
			return "/"
		}
		return trimmed
	}
	return path
}

func mustParseURL(rawURL string) *url.URL {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		log.Fatalf("invalid target url %q: %v", rawURL, err)
	}
	return parsedURL
}

func main() {
	addr := defaultProxyAddr
	noVNCTarget := mustParseURL(defaultNoVNCTarget)
	passthroughProxy := newPassthroughProxy(noVNCTarget)
	noVNCProxy := newPrefixProxy(noVNCPathPrefix, noVNCTarget)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/" {
			http.NotFound(writer, request)
			return
		}
		http.Redirect(writer, request, noVNCPathPrefix+"/vnc.html?autoconnect=true&resize=remote&path=websockify", http.StatusFound)
	})
	mux.HandleFunc("/healthz", func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
		_, _ = writer.Write([]byte("ok"))
	})
	mux.Handle(noVNCPathPrefix+"/", noVNCProxy)
	mux.HandleFunc(noVNCPathPrefix, func(writer http.ResponseWriter, request *http.Request) {
		redirectTarget := noVNCPathPrefix + "/"
		if request.URL.RawQuery != "" {
			redirectTarget += "?" + request.URL.RawQuery
		}
		http.Redirect(writer, request, redirectTarget, http.StatusPermanentRedirect)
	})
	mux.Handle(websockifyPath, passthroughProxy)

	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("sandbox proxy listening on %s", addr)
	log.Printf("sandbox proxy novnc target=%s", noVNCTarget)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("sandbox proxy failed: %v", err)
	}
}
