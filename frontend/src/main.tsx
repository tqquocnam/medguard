import React from "react";

import ReactDOM
  from "react-dom/client";

import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";

import {
  ApolloProvider,
} from "@apollo/client/react";

import {
  BrowserRouter,
} from "react-router-dom";

import App
  from "./App";

import {
  AuthProvider,
  notifyUnauthorized,
} from "./auth/AuthContext";

import "./index.css";


// ======================================================
// GRAPHQL FETCH
// ======================================================
//
// Tất cả request GraphQL đi qua:
//
// frontend
//    ↓
// http://localhost:3000/api/graphql
//    ↓
// backend requireAuth
//    ↓
// Hasura
//
// Nếu backend trả HTTP 401:
//
// JWT hết hạn
// USER bị khóa
// USER bị xóa
// JWT không hợp lệ
//
// thì:
//
// notifyUnauthorized()
//    ↓
// AuthContext user = null
//    ↓
// ProtectedRoute
//    ↓
// /login
//
// ======================================================

const graphqlFetch:
  typeof fetch =
  async (
    input,
    init
  ) => {

    const response =
      await fetch(
        input,
        {
          ...init,

          credentials:
            "include",
        }
      );


    if (
      response.status ===
      401
    ) {

      notifyUnauthorized();
    }


    return response;
  };


// ======================================================
// HTTP LINK
// ======================================================
//
// KHÔNG gọi trực tiếp Hasura.
// KHÔNG chứa Hasura admin secret.
//
// ======================================================

const httpLink =
  new HttpLink({

    uri:
      "http://localhost:3000/api/graphql",

    credentials:
      "include",

    fetch:
      graphqlFetch,
  });


// ======================================================
// APOLLO CLIENT
// ======================================================

const client =
  new ApolloClient({

    link:
      httpLink,

    cache:
      new InMemoryCache(),
  });


// ======================================================
// APP
// ======================================================

ReactDOM
  .createRoot(
    document.getElementById(
      "root"
    )!
  )
  .render(

    <React.StrictMode>

      <ApolloProvider
        client={
          client
        }
      >

        <BrowserRouter>

          <AuthProvider>

            <App />

          </AuthProvider>

        </BrowserRouter>

      </ApolloProvider>

    </React.StrictMode>
  );