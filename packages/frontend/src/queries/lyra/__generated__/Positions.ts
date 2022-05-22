/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: Positions
// ====================================================

export interface Positions_positions_strike {
  __typename: "Strike";
  /**
   *  Strike price 
   */
  strikePrice: any;
}

export interface Positions_positions {
  __typename: "Position";
  /**
   *  Market Address - PositionId 
   */
  id: string;
  /**
   *  Position ID 
   */
  positionId: number;
  /**
   *  Current position size 
   */
  size: any;
  /**
   *  Strike Reference 
   */
  strike: Positions_positions_strike | null;
}

export interface Positions {
  positions: Positions_positions[];
}

export interface PositionsVariables {
  positions?: (number | null)[] | null;
}
