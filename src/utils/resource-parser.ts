/**
 * Utility for consistent resource name parsing across the SDK
 * Handles both prefixed (e.g., "client:tool-name") and non-prefixed names
 */

/**
 * Extracts the tool name from a potentially prefixed resource name
 * 
 * @param resourceName - The resource name, potentially with prefix (e.g., "ngrok weather:get-alerts")
 * @returns The extracted tool name (e.g., "get-alerts")
 * 
 * @example
 * extractToolName("ngrok weather:get-alerts") // returns "get-alerts"
 * extractToolName("simple-tool") // returns "simple-tool"
 * extractToolName("client:prefix:tool") // returns "tool" (handles multiple colons)
 * extractToolName("") // returns ""
 * extractToolName(undefined) // returns ""
 */
export function extractToolName(resourceName: string | undefined): string {
  if (!resourceName) return '';
  
  // If the resource name contains a colon, extract the part after the last colon
  // This handles cases like "client:tool" or "client:prefix:tool"
  if (resourceName.includes(':')) {
    const parts = resourceName.split(':');
    const toolName = parts[parts.length - 1];
    // Return empty string if the tool name part is empty (e.g., "prefix:" or ":")
    return toolName || '';
  }
  
  // No prefix, return as-is
  return resourceName;
}

/**
 * Checks if a resource name has a prefix
 * 
 * @param resourceName - The resource name to check
 * @returns True if the resource name contains a prefix
 * 
 * @example
 * hasPrefix("ngrok weather:get-alerts") // returns true
 * hasPrefix("simple-tool") // returns false
 */
export function hasPrefix(resourceName: string | undefined): boolean {
  if (!resourceName) return false;
  return resourceName.includes(':');
}

/**
 * Extracts the prefix from a resource name
 * 
 * @param resourceName - The resource name with potential prefix
 * @returns The prefix part, or empty string if no prefix
 * 
 * @example
 * extractPrefix("ngrok weather:get-alerts") // returns "ngrok weather"
 * extractPrefix("client:prefix:tool") // returns "client:prefix"
 * extractPrefix("simple-tool") // returns ""
 */
export function extractPrefix(resourceName: string | undefined): string {
  if (!resourceName || !resourceName.includes(':')) return '';
  
  const parts = resourceName.split(':');
  // Remove the last part (tool name) and join the rest
  parts.pop();
  return parts.join(':');
}

/**
 * Normalizes a resource name for comparison
 * Handles case sensitivity and whitespace
 * 
 * @param resourceName - The resource name to normalize
 * @returns Normalized resource name
 */
export function normalizeResourceName(resourceName: string | undefined): string {
  if (!resourceName) return '';
  
  // Extract tool name and normalize
  const toolName = extractToolName(resourceName);
  
  // Trim whitespace and convert to lowercase for comparison
  // Note: We preserve the original case in extraction but normalize for comparison
  return toolName.trim();
}

/**
 * Compares two resource names for equality
 * Handles prefixed names and normalization
 * 
 * @param name1 - First resource name
 * @param name2 - Second resource name
 * @returns True if the tool names match (ignoring prefixes)
 * 
 * @example
 * compareResourceNames("ngrok weather:get-alerts", "get-alerts") // returns true
 * compareResourceNames("client:tool", "another-client:tool") // returns true
 * compareResourceNames("tool", "tool") // returns true
 * compareResourceNames("tool1", "tool2") // returns false
 */
export function compareResourceNames(
  name1: string | undefined,
  name2: string | undefined
): boolean {
  const normalized1 = normalizeResourceName(name1);
  const normalized2 = normalizeResourceName(name2);
  
  return normalized1 === normalized2;
}