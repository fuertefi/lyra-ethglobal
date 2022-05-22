import styled from "styled-components";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  max-width: 1272px;
  margin: 0 auto;
  justify-content: space-between;
  margin-bottom: 53px;
`;

const WhiteText = styled.span`
  color: white;
`;
const GreenText = styled.span`
  color: #06c799;
`;

export const Footer = () => {
  return (
    <Container>
      <span>
        <GreenText>Covered Strangle</GreenText> Strategy on Lyra. HackMoney 2022
      </span>
      <WhiteText>The Future of Finance</WhiteText>
    </Container>
  );
};
