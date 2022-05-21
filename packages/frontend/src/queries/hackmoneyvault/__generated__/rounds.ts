/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: rounds
// ====================================================

export interface rounds_rounds {
  __typename: "Round";
  id: string;
  lockedAmount: any | null;
  createdAt: any | null;
  roundInProgress: boolean | null;
  expiry: any | null;
}

export interface rounds {
  rounds: rounds_rounds[];
}
