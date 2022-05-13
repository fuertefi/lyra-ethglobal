import ManageLiquidity from "../components/ManageLiquidity";
import styled from "styled-components";

const ContentColumns = styled.div`
  display: flex;
  flex-direction: row;

  .left-section {
    width: 60%;
  }
  .right-section {
    width: 40%;
  }
`;

const Header = styled.header`
  font-family: "Clash Display";
  font-size: 48px;
`;

export const Main = () => {
  return (
    <ContentColumns>
      <div className="left-section">
        <Header>
          Strategy<strong>Name</strong>
        </Header>
      </div>
      <div className="right-section">
        <ManageLiquidity />
      </div>
    </ContentColumns>
  );
};
