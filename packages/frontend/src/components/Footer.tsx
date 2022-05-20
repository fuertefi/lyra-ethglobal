import styled from "styled-components";

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  margin-left: 56px;
  margin-right: 56px;
  margin-bottom: 53px;
`;

const WhiteText = styled.span`
  color: white;
`;
const GreenText = styled.span`
  color: #06C799;
`;

export const Footer = () => {
  return (
    <Container>
      <span><GreenText>Covered Strangle</GreenText> Strategy on Lyra. HackMoney 2022</span>
      <WhiteText>The Future of Finance</WhiteText>
    </Container>
  );
};
