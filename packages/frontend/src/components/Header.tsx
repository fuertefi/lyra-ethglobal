import { ConnectButton } from "@rainbow-me/rainbowkit";
import styled from "styled-components";

const Container = styled.div`
    display: flex;
    justify-content: space-between;
`;

export const Header = () => (
    <Container style={{ margin: "30px" }}>
        <img src="/logo.svg" alt="0" width="200" />
        <ConnectButton />
    </Container>
);
