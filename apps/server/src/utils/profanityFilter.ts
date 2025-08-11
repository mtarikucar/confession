// Basic profanity filter - can be enhanced with more sophisticated libraries
const profanityList = [
  // Add actual profanity words here
  // This is a placeholder implementation
];

export function filterProfanity(text: string): string {
  let filtered = text;
  
  profanityList.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  
  return filtered;
}

export function containsProfanity(text: string): boolean {
  const lowerText = text.toLowerCase();
  return profanityList.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(lowerText);
  });
}