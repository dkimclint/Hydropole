<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $pdo = new PDO('mysql:host=localhost;dbname=hydropole','root','', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Get latest flood data with device information
    $stmt = $pdo->query("
        SELECT 
            fd.device_id, 
            hd.device_name,  
            hd.current_lat, 
            hd.current_lng, 
            fd.water_level, 
            fd.status, 
            fd.message, 
            fd.timestamp
        FROM flood_data fd
        LEFT JOIN hydropole_devices hd ON fd.device_id = hd.device_id
        WHERE fd.timestamp = (
            SELECT MAX(timestamp) 
            FROM flood_data f2 
            WHERE f2.device_id = fd.device_id
        )
        ORDER BY fd.timestamp DESC
    ");
    
    $readings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'status' => 'success', 
        'data' => $readings,
        'count' => count($readings)
    ]);
    
} catch(PDOException $e) {
    echo json_encode([
        'status' => 'error', 
        'message' => $e->getMessage()
    ]);
}
?>