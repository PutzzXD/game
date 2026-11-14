-- ================== MALAM SAMA OPAH - ITEM, OPAH, NOCLIP, DOOR TP ==================
-- ================== BY PUTZZDEV ==================
-- Fitur: ESP Item/Kode, ESP Opah, Noclip, TP ke pintu yang masih terkunci
-- UI: Custom Draggable & Minimize

-- ================== LOAD SERVICES ==================
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")
local UserInputService = game:GetService("UserInputService")
local CoreGui = game:GetService("CoreGui")
local LocalPlayer = Players.LocalPlayer

-- ================== KONFIGURASI ==================
local TargetKeywords = {
    ["Key"] = {Color = Color3.fromRGB(255, 215, 0), Name = "KUNCI"},
    ["Keycard"] = {Color = Color3.fromRGB(0, 191, 255), Name = "KARTU"},
    ["Code"] = {Color = Color3.fromRGB(255, 0, 0), Name = "KODE"},
    ["Note"] = {Color = Color3.fromRGB(255, 255, 255), Name = "CATATAN"},
    ["Password"] = {Color = Color3.fromRGB(255, 105, 180), Name = "PASSWORD"}
}

-- Nama model Opah (kalau nama di game beda, tambahin di sini)
local OpahKeywords = {"opah", "nenek", "kakek", "grandpa", "grandma", "granny", "grandfather"}
local OpahColor = Color3.fromRGB(255, 40, 40)

-- Nama objek pintu
local DoorKeywords = {"door", "pintu", "gate", "gerbang"}

-- Kata penanda status terkunci (attribute / value / prompt)
local LockAttributeNames = {"Locked", "IsLocked", "locked", "isLocked", "Terkunci"}
local UnlockedAttributeNames = {"Unlocked", "IsUnlocked", "unlocked", "isUnlocked", "Open", "IsOpen"}

-- ================== STATE ==================
local ESPObjects = {}
local OpahObjects = {} -- {model, label, highlight, billboard}
local IsESPActive = false
local IsOpahActive = false
local IsNoclip = false
local NoclipConn = nil
local LockedDoorIndex = 0

-- ================== HELPER ==================
local function NameMatches(name, list)
    name = name:lower()
    for _, kw in ipairs(list) do
        if name:find(kw, 1, true) then return true end
    end
    return false
end

local function GetRoot()
    local char = LocalPlayer.Character
    return char and char:FindFirstChild("HumanoidRootPart")
end

local function GetPosition(obj)
    if obj:IsA("BasePart") then return obj.Position end
    if obj:IsA("Model") then
        local ok, pivot = pcall(function() return obj:GetPivot() end)
        if ok then return pivot.Position end
    end
    return nil
end

local function IsPlayerCharacter(model)
    for _, plr in ipairs(Players:GetPlayers()) do
        if plr.Character == model then return true end
    end
    return false
end

-- ================== ESP ITEM & KODE ==================
local function ClearESP()
    for _, obj in pairs(ESPObjects) do
        pcall(function() obj:Destroy() end)
    end
    ESPObjects = {}
end

local function ScanForItems()
    ClearESP()
    if not IsESPActive then return end

    for _, obj in pairs(Workspace:GetDescendants()) do
        if obj:IsA("BasePart") or obj:IsA("Model") then
            local objName = obj.Name:lower()
            for keyword, data in pairs(TargetKeywords) do
                if objName:find(keyword:lower()) then
                    local highlight = Instance.new("Highlight")
                    highlight.Name = "PutzzESP_Target"
                    highlight.Adornee = obj
                    highlight.FillColor = data.Color
                    highlight.FillTransparency = 0.5
                    highlight.OutlineColor = data.Color
                    highlight.OutlineTransparency = 0
                    highlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
                    highlight.Parent = CoreGui
                    table.insert(ESPObjects, highlight)

                    local part = obj:IsA("BasePart") and obj or obj:FindFirstChildWhichIsA("BasePart")
                    if part then
                        local billboard = Instance.new("BillboardGui")
                        billboard.Name = "PutzzESP_Label"
                        billboard.Adornee = part
                        billboard.Size = UDim2.new(0, 150, 0, 50)
                        billboard.StudsOffset = Vector3.new(0, 2, 0)
                        billboard.AlwaysOnTop = true
                        billboard.Parent = CoreGui

                        local textLabel = Instance.new("TextLabel")
                        textLabel.Size = UDim2.new(1, 0, 1, 0)
                        textLabel.BackgroundTransparency = 1
                        textLabel.Text = data.Name .. " [" .. obj.Name .. "]"
                        textLabel.TextColor3 = data.Color
                        textLabel.TextStrokeTransparency = 0
                        textLabel.TextStrokeColor3 = Color3.new(0, 0, 0)
                        textLabel.TextScaled = true
                        textLabel.Font = Enum.Font.GothamBold
                        textLabel.Parent = billboard

                        table.insert(ESPObjects, billboard)
                    end
                    break
                end
            end
        end
    end
end

-- ================== ESP OPAH ==================
local function ClearOpah()
    for _, entry in ipairs(OpahObjects) do
        pcall(function() entry.highlight:Destroy() end)
        pcall(function() entry.billboard:Destroy() end)
    end
    OpahObjects = {}
end

local function ScanForOpah()
    ClearOpah()
    if not IsOpahActive then return end

    local found = {}
    for _, obj in ipairs(Workspace:GetDescendants()) do
        if obj:IsA("Model") and not IsPlayerCharacter(obj) and NameMatches(obj.Name, OpahKeywords) then
            -- lewati kalau ini bagian dari model Opah yang sudah ketemu
            local nested = false
            for _, f in ipairs(found) do
                if obj:IsDescendantOf(f) then nested = true break end
            end
            if not nested then
                table.insert(found, obj)
            end
        end
    end

    for _, model in ipairs(found) do
        local highlight = Instance.new("Highlight")
        highlight.Name = "PutzzESP_Opah"
        highlight.Adornee = model
        highlight.FillColor = OpahColor
        highlight.FillTransparency = 0.4
        highlight.OutlineColor = OpahColor
        highlight.OutlineTransparency = 0
        highlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
        highlight.Parent = CoreGui

        local part = model.PrimaryPart or model:FindFirstChildWhichIsA("BasePart", true)
        local billboard, label
        if part then
            billboard = Instance.new("BillboardGui")
            billboard.Name = "PutzzESP_OpahLabel"
            billboard.Adornee = part
            billboard.Size = UDim2.new(0, 160, 0, 40)
            billboard.StudsOffset = Vector3.new(0, 4, 0)
            billboard.AlwaysOnTop = true
            billboard.Parent = CoreGui

            label = Instance.new("TextLabel")
            label.Size = UDim2.new(1, 0, 1, 0)
            label.BackgroundTransparency = 1
            label.Text = "OPAH"
            label.TextColor3 = OpahColor
            label.TextStrokeTransparency = 0
            label.TextStrokeColor3 = Color3.new(0, 0, 0)
            label.TextScaled = true
            label.Font = Enum.Font.GothamBold
            label.Parent = billboard
        end

        table.insert(OpahObjects, {model = model, label = label, highlight = highlight, billboard = billboard})
    end
end

-- update jarak ke Opah
task.spawn(function()
    while task.wait(0.25) do
        if IsOpahActive then
            local root = GetRoot()
            for _, entry in ipairs(OpahObjects) do
                if entry.label and root and entry.model.Parent then
                    local pos = GetPosition(entry.model)
                    if pos then
                        local dist = math.floor((pos - root.Position).Magnitude)
                        entry.label.Text = "OPAH [" .. dist .. "m]"
                    end
                end
            end
        end
    end
end)

-- ================== NOCLIP ==================
local function SetNoclip(state)
    IsNoclip = state
    if NoclipConn then
        NoclipConn:Disconnect()
        NoclipConn = nil
    end
    if state then
        NoclipConn = RunService.Stepped:Connect(function()
            local char = LocalPlayer.Character
            if not char then return end
            for _, part in ipairs(char:GetDescendants()) do
                if part:IsA("BasePart") and part.CanCollide then
                    part.CanCollide = false
                end
            end
        end)
    end
end

-- ================== DETEKSI PINTU TERKUNCI ==================
local function GetAttr(obj, names)
    for _, n in ipairs(names) do
        local v = obj:GetAttribute(n)
        if v ~= nil then return v end
    end
    return nil
end

-- return true = terkunci, false = terbuka/tidak diketahui
local function IsDoorLocked(door)
    local nodes = {door}
    for _, d in ipairs(door:GetDescendants()) do
        table.insert(nodes, d)
    end

    for _, n in ipairs(nodes) do
        -- Attribute
        local locked = GetAttr(n, LockAttributeNames)
        if locked == true then return true end
        local unlocked = GetAttr(n, UnlockedAttributeNames)
        if unlocked == false then return true end

        -- BoolValue
        if n:IsA("BoolValue") then
            local lname = n.Name:lower()
            if lname:find("lock", 1, true) and not lname:find("unlock", 1, true) and n.Value == true then
                return true
            end
            if (lname:find("unlock", 1, true) or lname == "open" or lname == "isopen") and n.Value == false then
                return true
            end
        end

        -- ProximityPrompt (teks "Locked" / "Terkunci")
        if n:IsA("ProximityPrompt") and n.Enabled then
            local text = (n.ActionText .. " " .. n.ObjectText):lower()
            if (text:find("lock", 1, true) or text:find("kunci", 1, true) or text:find("terkunci", 1, true))
                and not text:find("unlock", 1, true) and not text:find("buka", 1, true) then
                return true
            end
        end

        -- Text label di pintu (mis. SurfaceGui "Locked")
        if n:IsA("TextLabel") and n.Visible then
            local text = n.Text:lower()
            if text:find("locked", 1, true) or text:find("terkunci", 1, true) then
                return true
            end
        end
    end
    return false
end

local function FindDoors()
    local doors = {}
    for _, obj in ipairs(Workspace:GetDescendants()) do
        if (obj:IsA("Model") or obj:IsA("BasePart")) and NameMatches(obj.Name, DoorKeywords) then
            -- ambil objek pintu paling atas saja (skip anak dari pintu lain)
            local nested = false
            local p = obj.Parent
            while p and p ~= Workspace do
                if NameMatches(p.Name, DoorKeywords) then nested = true break end
                p = p.Parent
            end
            if not nested then
                table.insert(doors, obj)
            end
        end
    end
    return doors
end

local function FindLockedDoors()
    local result = {}
    local root = GetRoot()
    for _, door in ipairs(FindDoors()) do
        if IsDoorLocked(door) then
            table.insert(result, door)
        end
    end
    -- urutkan dari yang terdekat
    if root then
        table.sort(result, function(a, b)
            local pa, pb = GetPosition(a), GetPosition(b)
            if not pa then return false end
            if not pb then return true end
            return (pa - root.Position).Magnitude < (pb - root.Position).Magnitude
        end)
    end
    return result
end

local function TeleportToDoor(door)
    local root = GetRoot()
    local doorPos = GetPosition(door)
    if not root or not doorPos then return false end

    -- berdiri sedikit di depan pintu (sisi tempat kita berdiri sekarang)
    local dir = root.Position - doorPos
    dir = Vector3.new(dir.X, 0, dir.Z)
    if dir.Magnitude < 0.1 then dir = Vector3.new(0, 0, 1) end
    local target = doorPos + dir.Unit * 4 + Vector3.new(0, 3, 0)
    root.CFrame = CFrame.new(target, Vector3.new(doorPos.X, target.Y, doorPos.Z))
    return true
end

-- ================== CUSTOM UI SYSTEM ==================
local FULL_HEIGHT = 290
local ScreenGui = Instance.new("ScreenGui")
ScreenGui.Name = "PutzzDev_CustomUI"
ScreenGui.ResetOnSpawn = false
ScreenGui.Parent = CoreGui

local MainFrame = Instance.new("Frame")
MainFrame.Name = "MainFrame"
MainFrame.Size = UDim2.new(0, 240, 0, FULL_HEIGHT)
MainFrame.Position = UDim2.new(0, 20, 0, 20)
MainFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
MainFrame.BackgroundTransparency = 0.1
MainFrame.BorderSizePixel = 0
MainFrame.Visible = true
MainFrame.Parent = ScreenGui

local UICorner = Instance.new("UICorner")
UICorner.CornerRadius = UDim.new(0, 8)
UICorner.Parent = MainFrame

local UIStroke = Instance.new("UIStroke")
UIStroke.Color = Color3.fromRGB(0, 255, 136)
UIStroke.Thickness = 1.5
UIStroke.Transparency = 0.5
UIStroke.Parent = MainFrame

local TopBar = Instance.new("Frame")
TopBar.Name = "TopBar"
TopBar.Size = UDim2.new(1, 0, 0, 30)
TopBar.BackgroundColor3 = Color3.fromRGB(25, 25, 35)
TopBar.BackgroundTransparency = 0.2
TopBar.BorderSizePixel = 0
TopBar.Parent = MainFrame

local TopCorner = Instance.new("UICorner")
TopCorner.CornerRadius = UDim.new(0, 8)
TopCorner.Parent = TopBar

local Title = Instance.new("TextLabel")
Title.Size = UDim2.new(1, -60, 1, 0)
Title.Position = UDim2.new(0, 10, 0, 0)
Title.BackgroundTransparency = 1
Title.Text = "Putzzdev | Opah"
Title.TextColor3 = Color3.fromRGB(0, 255, 136)
Title.TextXAlignment = Enum.TextXAlignment.Left
Title.Font = Enum.Font.GothamBold
Title.TextSize = 12
Title.Parent = TopBar

local MinBtn = Instance.new("TextButton")
MinBtn.Size = UDim2.new(0, 30, 0, 30)
MinBtn.Position = UDim2.new(1, -60, 0, 0)
MinBtn.BackgroundTransparency = 1
MinBtn.Text = "—"
MinBtn.TextColor3 = Color3.fromRGB(200, 200, 200)
MinBtn.Font = Enum.Font.GothamBold
MinBtn.TextSize = 14
MinBtn.Parent = TopBar

local CloseBtn = Instance.new("TextButton")
CloseBtn.Size = UDim2.new(0, 30, 0, 30)
CloseBtn.Position = UDim2.new(1, -30, 0, 0)
CloseBtn.BackgroundTransparency = 1
CloseBtn.Text = "X"
CloseBtn.TextColor3 = Color3.fromRGB(255, 100, 100)
CloseBtn.Font = Enum.Font.GothamBold
CloseBtn.TextSize = 14
CloseBtn.Parent = TopBar

local Content = Instance.new("Frame")
Content.Name = "Content"
Content.Size = UDim2.new(1, 0, 1, -30)
Content.Position = UDim2.new(0, 0, 0, 30)
Content.BackgroundTransparency = 1
Content.Parent = MainFrame

-- Pembuat tombol
local GREEN = Color3.fromRGB(0, 255, 136)

local function MakeButton(text, y, isToggle)
    local btn = Instance.new("TextButton")
    btn.Size = UDim2.new(1, -20, 0, 32)
    btn.Position = UDim2.new(0, 10, 0, y)
    btn.BackgroundColor3 = isToggle and GREEN or Color3.fromRGB(40, 40, 50)
    btn.BackgroundTransparency = isToggle and 0.8 or 0
    btn.Text = text
    btn.TextColor3 = isToggle and GREEN or Color3.fromRGB(200, 200, 200)
    btn.Font = Enum.Font.GothamBold
    btn.TextSize = 11
    btn.Parent = Content

    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 6)
    corner.Parent = btn

    if isToggle then
        local stroke = Instance.new("UIStroke")
        stroke.Color = GREEN
        stroke.Parent = btn
    end
    return btn
end

local function SetToggleVisual(btn, state, onText, offText)
    if state then
        btn.Text = onText
        btn.BackgroundTransparency = 0.2
        btn.TextColor3 = Color3.fromRGB(0, 0, 0)
    else
        btn.Text = offText
        btn.BackgroundTransparency = 0.8
        btn.TextColor3 = GREEN
    end
end

local ToggleBtn = MakeButton("TAMPILKAN LOKASI KUNCI", 8, true)
local OpahBtn = MakeButton("ESP OPAH: OFF", 46, true)
local NoclipBtn = MakeButton("NOCLIP: OFF", 84, true)
local DoorBtn = MakeButton("TP KE PINTU TERKUNCI", 122, false)
local RefreshBtn = MakeButton("SCAN ULANG MAP", 160, false)

local StatusText = Instance.new("TextLabel")
StatusText.Size = UDim2.new(1, -20, 0, 50)
StatusText.Position = UDim2.new(0, 10, 0, 198)
StatusText.BackgroundTransparency = 1
StatusText.Text = "Status: Menunggu..."
StatusText.TextColor3 = Color3.fromRGB(150, 150, 150)
StatusText.Font = Enum.Font.Gotham
StatusText.TextSize = 10
StatusText.TextXAlignment = Enum.TextXAlignment.Left
StatusText.TextYAlignment = Enum.TextYAlignment.Top
StatusText.TextWrapped = true
StatusText.Parent = Content

local function SetStatus(text, active)
    StatusText.Text = "Status: " .. text
    StatusText.TextColor3 = active and GREEN or Color3.fromRGB(150, 150, 150)
end

-- ================== FUNGSI TOMBOL ==================
ToggleBtn.MouseButton1Click:Connect(function()
    IsESPActive = not IsESPActive
    SetToggleVisual(ToggleBtn, IsESPActive, "SEMBUNYIKAN LOKASI KUNCI", "TAMPILKAN LOKASI KUNCI")
    if IsESPActive then
        SetStatus("ESP item aktif", true)
        ScanForItems()
    else
        SetStatus("ESP item nonaktif", false)
        ClearESP()
    end
end)

OpahBtn.MouseButton1Click:Connect(function()
    IsOpahActive = not IsOpahActive
    SetToggleVisual(OpahBtn, IsOpahActive, "ESP OPAH: ON", "ESP OPAH: OFF")
    if IsOpahActive then
        ScanForOpah()
        if #OpahObjects == 0 then
            SetStatus("Opah belum ketemu di map (akan dicari ulang tiap 5 detik)", true)
        else
            SetStatus("Opah terdeteksi: " .. #OpahObjects, true)
        end
    else
        ClearOpah()
        SetStatus("ESP Opah nonaktif", false)
    end
end)

NoclipBtn.MouseButton1Click:Connect(function()
    SetNoclip(not IsNoclip)
    SetToggleVisual(NoclipBtn, IsNoclip, "NOCLIP: ON", "NOCLIP: OFF")
    SetStatus(IsNoclip and "Noclip aktif" or "Noclip nonaktif", IsNoclip)
end)

DoorBtn.MouseButton1Click:Connect(function()
    local locked = FindLockedDoors()
    if #locked == 0 then
        local total = #FindDoors()
        SetStatus("Tidak ada pintu terkunci terdeteksi (total pintu: " .. total .. ")", false)
        return
    end
    -- klik berulang = pindah ke pintu terkunci berikutnya
    LockedDoorIndex = LockedDoorIndex % #locked + 1
    local door = locked[LockedDoorIndex]
    if TeleportToDoor(door) then
        SetStatus("TP ke " .. door.Name .. " (" .. LockedDoorIndex .. "/" .. #locked .. ")", true)
    else
        SetStatus("Gagal TP, karakter belum siap", false)
    end
end)

RefreshBtn.MouseButton1Click:Connect(function()
    SetStatus("Re-scanning...", true)
    if IsESPActive then ScanForItems() end
    if IsOpahActive then ScanForOpah() end
    LockedDoorIndex = 0
    SetStatus("Selesai re-scan! Pintu terkunci: " .. #FindLockedDoors(), true)
end)

-- ================== DRAG SYSTEM ==================
local dragging = false
local dragInput, dragStart, startPos

TopBar.InputBegan:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = input.Position
        startPos = MainFrame.Position

        input.Changed:Connect(function()
            if input.UserInputState == Enum.UserInputState.End then
                dragging = false
            end
        end)
    end
end)

TopBar.InputChanged:Connect(function(input)
    if input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch then
        dragInput = input
    end
end)

UserInputService.InputChanged:Connect(function(input)
    if input == dragInput and dragging then
        local delta = input.Position - dragStart
        MainFrame.Position = UDim2.new(startPos.X.Scale, startPos.X.Offset + delta.X, startPos.Y.Scale, startPos.Y.Offset + delta.Y)
    end
end)

-- ================== MINIMIZE / CLOSE ==================
local isMinimized = false
MinBtn.MouseButton1Click:Connect(function()
    isMinimized = not isMinimized
    if isMinimized then
        Content.Visible = false
        MainFrame.Size = UDim2.new(0, 240, 0, 30)
        MinBtn.Text = "+"
    else
        Content.Visible = true
        MainFrame.Size = UDim2.new(0, 240, 0, FULL_HEIGHT)
        MinBtn.Text = "—"
    end
end)

CloseBtn.MouseButton1Click:Connect(function()
    IsESPActive = false
    IsOpahActive = false
    SetNoclip(false)
    ClearESP()
    ClearOpah()
    ScreenGui:Destroy()
end)

-- ================== AUTO UPDATE SCAN ==================
task.spawn(function()
    while task.wait(5) do
        if not ScreenGui.Parent then break end
        if IsESPActive then ScanForItems() end
        if IsOpahActive then ScanForOpah() end
    end
end)

print("[PUTZZDEV] Opah: ESP Item, ESP Opah, Noclip, TP Pintu Terkunci Loaded.")
