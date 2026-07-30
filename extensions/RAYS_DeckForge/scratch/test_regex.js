const trimmedPath = "/home/aryan/Personal/projects/RAYS_DECK/app_data/exports/True-Table-of-Contents-1-Introduction-2_ca8f15c5-a072-42fb-a582-0af62c268c9a.pdf";
const appDataMatch = trimmedPath.match(/[\/\\]app_data[\/\\](.+)$/);
if (appDataMatch) {
  console.log("Match found!");
  console.log("Captured:", appDataMatch[1]);
} else {
  console.log("No match.");
}
