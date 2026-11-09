/** Sentence case for a label as written: the first letter up, the rest left
    alone, so "RSI", "AI" and "24/7 tape" survive. Case is presentation here;
    the words themselves stay the ones lib/quant/reads and the registry print. */
export const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
