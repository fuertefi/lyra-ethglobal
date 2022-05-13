import ManageLiquidity from "../components/ManageLiquidity";
import styled from "styled-components";
import VaultDescription from "../components/Strategy/VaultDescription";

const ContentColumns = styled.div`
  display: flex;
  flex-direction: row;

  max-width: 1272px;
  margin: 0 auto;

  .left-section {
    flex-grow: 1;
    padding-right: 50px;
  }
  .right-section {
    min-width: 400px;
  }
`;

const Header = styled.header`
  font-family: "Clash Display";
  font-size: 48px;
  margin-bottom: 37px;
`;

export const Main = () => {
  return (
    <ContentColumns>
      <div className="left-section">
        <Header>
          Strategy<strong>Name</strong>
        </Header>
        <VaultDescription>
          Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet
          sint. Velit officia consequat duis enim velit mollit. Exercitation
          veniam consequat sunt nostrud amet. Velit officia consequat duis enim
          velit mollit. met minim mollit non deserunt ullamco est sit aliqua.
        </VaultDescription>
      </div>
      <div className="right-section">
        <ManageLiquidity />
      </div>
    </ContentColumns>
  );
};
