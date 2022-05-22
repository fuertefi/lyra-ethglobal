export const lightGray = "#99A0AB";
export const red = "#DC583B";
export const white = "#FFFFFF";
export const black = "#131517";
export const darkGray = "#1F2124";
export const disabledGray = "#696D74";
export const accentGreen = "#06C799";

export const theme = {
  position: {
    bg: "#2C2E32",
    inactiveTabBg: darkGray,
    tabs: {
      inactive: {
        bg: darkGray,
        color: "#42454A",
      },
    },
    input: {
      placeholder: {
        color: lightGray,
      },
      border: {
        normal: lightGray,
        error: red,
      },
      error: red,
      color: white,
    },
  },
  button: {
    bg: accentGreen,
    color: black,
  },
  icons: {
    error: "#DC583B",
  },
  metrics: {
    background: "transparent",
    border: "1px solid #414447",
    // borderColor: "#414447",
    progress: {
      background: {
        color: darkGray,
        border: "#2C2E30",
      },
      inner: {
        color: black,
        border: "#2C2E30",
      },
    },
    accent: {
      color: "#CED4DC",
    },
  },
  charts: {
    background: "#233A35",
    stroke: accentGreen,
  },
};
