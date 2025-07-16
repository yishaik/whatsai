// Storage Fix Script for AI Persona Chat
// Run this in the browser console if you're experiencing quota exceeded errors

console.log('🔧 Storage Fix Script for AI Persona Chat');
console.log('=========================================');

// Check current storage usage
function checkStorage() {
  let total = 0;
  const items = {};
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      const size = new Blob([value]).size;
      total += size;
      items[key] = size;
    }
  }
  
  console.log(`📊 Total storage used: ${(total / 1024 / 1024).toFixed(2)} MB`);
  console.log('📋 Storage breakdown:');
  Object.entries(items)
    .sort(([,a], [,b]) => b - a)
    .forEach(([key, size]) => {
      console.log(`  - ${key}: ${(size / 1024).toFixed(2)} KB`);
    });
  
  return total;
}

// Option 1: Clear everything except personas
function clearChatsOnly() {
  console.log('\n🗑️ Clearing chat data...');
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key !== 'personas') {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`  ✓ Removed ${key}`);
  });
  
  console.log('✅ Chat data cleared. Personas preserved.');
  console.log('🔄 Please refresh the page.');
}

// Option 2: Reset personas to defaults (removes large avatars)
function resetPersonasToDefaults() {
  console.log('\n🔄 Resetting personas to defaults...');
  localStorage.removeItem('personas');
  console.log('✅ Personas reset. Large avatars removed.');
  console.log('🔄 Please refresh the page.');
}

// Option 3: Clear everything
function clearAllData() {
  console.log('\n⚠️ Clearing ALL data...');
  localStorage.clear();
  console.log('✅ All data cleared.');
  console.log('🔄 Please refresh the page.');
}

// Show current storage status
checkStorage();

// Provide options
console.log('\n🛠️ Available fixes:');
console.log('1. clearChatsOnly()     - Remove chat history, keep personas');
console.log('2. resetPersonasToDefaults() - Reset personas (removes custom avatars)');
console.log('3. clearAllData()       - Remove everything and start fresh');
console.log('\nType one of the above commands to fix the storage issue.'); 