import styled, { css } from "styled-components";

export const FlexColumn = styled.div`
  display: flex;
  flex-direction: column;
`;

export const FlexRow = styled.div<{ justifyContent?: string }>`
  display: flex;
  flex-direction: row;
  ${({ justifyContent }) =>
    justifyContent &&
    css`
      justify-content: ${justifyContent};
    `}
`;
