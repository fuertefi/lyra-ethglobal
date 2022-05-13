import styled from "styled-components";

const Container = styled.div`
  display: flex;
  justify-content: space-between;
`;

export const Header = () => (
  <Container>
    <span>Logo</span>
    <button>Connect wallet</button>
  </Container>
);
