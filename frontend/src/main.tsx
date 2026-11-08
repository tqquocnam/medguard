import React from "react";
import ReactDOM from "react-dom/client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";

import { ConfigProvider } from "antd";
import { BrowserRouter } from "react-router-dom";

import App from "./App";

import { AuthProvider, notifyUnauthorized } from "./auth/AuthContext";

import { API_BASE_URL } from "./api/apiClient";

import "./index.css";

// ======================================================
// FONT CHUNG
// ======================================================

const APP_FONT_FAMILY = '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

// ======================================================
// GRAPHQL FETCH
// ======================================================

const graphqlFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
  });

  if (response.status === 401) {
    notifyUnauthorized();
  }

  return response;
};

// ======================================================
// GRAPHQL URL
// ======================================================

const GRAPHQL_URL = `${API_BASE_URL}/graphql`;

// ======================================================
// HTTP LINK
// ======================================================

const httpLink = new HttpLink({
  uri: GRAPHQL_URL,
  credentials: "include",
  fetch: graphqlFetch,
});

// ======================================================
// APOLLO CLIENT
// ======================================================

const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
});

// ======================================================
// APP
// ======================================================

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          fontFamily: APP_FONT_FAMILY,
        },
      }}
    >
      <ApolloProvider client={client}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ApolloProvider>
    </ConfigProvider>
  </React.StrictMode>,
);
