import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";

import {
  API_BASE_URL,
} from "../api/apiClient";


export const apolloClient =
  new ApolloClient({
    link:
      new HttpLink({
        uri:
          `${API_BASE_URL}/graphql`,

        credentials:
          "include",
      }),

    cache:
      new InMemoryCache(),
  });